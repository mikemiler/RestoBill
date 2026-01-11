# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Meta: Keeping This File Updated

**IMPORTANT:** When making changes to the codebase, always update this CLAUDE.md file to reflect:
- New features or components added
- Changes to architecture or data flow
- New library files or utilities
- Changes to conventions or patterns
- Updates to terminology or naming

This file should always represent the current state of the project.

## Project Overview

**RestoBill** is a German-language web application for splitting restaurant bills. Users upload a receipt photo, Claude Vision API analyzes items automatically, and friends select their items via a shareable link to pay through PayPal.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Prisma, Supabase (PostgreSQL + Storage), Claude Vision API, Tailwind CSS

**Deployment:** Vercel (ALL code must be Vercel-compatible - see Deployment Notes section)

## Core Principle: KISS (Keep It Simple, Stupid)

- Favor simplicity over complexity
- Avoid over-engineering and premature abstractions
- Only add features when explicitly needed
- Keep code readable and maintainable
- No unnecessary dependencies or patterns

## Essential Commands

### Development
```bash
npm install              # Install dependencies (runs prisma generate)
npm run dev              # Start dev server (localhost:3000)
npm run build            # Production build
npm run lint             # Run ESLint
```

### Database
```bash
npx prisma generate      # Generate Prisma Client
npx prisma db push       # Push schema to database (no migrations)
npx prisma studio        # Open Prisma Studio GUI
```

### Testing Connections
```bash
npx ts-node test-supabase-connection.ts  # Verify Supabase connection
```

## Architecture & Data Model

### Database Schema (Prisma)

**Three main models with cascade delete:**

1. **Bill** - Restaurant bill created by payer
   - Contains: `payerName`, `paypalHandle`, `imageUrl`, `shareToken` (UUID)
   - Relations: `items[]`, `selections[]`

2. **BillItem** - Individual items on the bill
   - Contains: `name`, `quantity`, `pricePerUnit`, `totalPrice`
   - Belongs to one Bill

3. **Selection** - Friend's item selection
   - Contains: `friendName`, `itemQuantities` (JSON), `tipAmount`, `paid`
   - `itemQuantities` format: `{"itemId": multiplier}` (e.g., `{"uuid": 0.5}` for half portion)
   - Belongs to one Bill, references multiple BillItems

**Important:** Items can only be edited/deleted if no selections exist yet.

### Application Flow

**Payer Flow:**
1. Create bill → `POST /api/bills/create` → Get billId + shareToken
2. Upload image → `POST /api/bills/[id]/upload` → Claude analyzes items
3. Review/edit items (optional) → API routes in `/api/bill-items/`
4. Share link with friends → `/split/[shareToken]`
5. Monitor status → `/bills/[id]/status`

**Friend Flow:**
1. Open share link → Server-rendered page with bill data
2. View previous selections (if any) from localStorage
3. Select items with quantities (0, 0.5, 1, 2, custom fractions)
4. Add tip (0%, 7%, 10%, 15%, or custom)
5. Submit → `POST /api/selections/create` → Selection saved to localStorage → Returns PayPal.me URL
6. Redirect to `/payment-redirect` page (intermediary to keep browser open)
7. Auto-redirect to PayPal for payment (stays in browser, not app)
8. Can return and make additional selections (multiple payments per guest supported)

### API Routes Structure

All routes follow RESTful patterns:

- `POST /api/bills/create` - Create bill with payer info
- `POST /api/bills/[id]/upload` - Upload & analyze image
- `POST /api/bill-items/create` - Add item manually
- `PUT /api/bill-items/[id]` - Edit item (only if no selections)
- `DELETE /api/bill-items/[id]` - Delete item (only if no selections)
- `POST /api/selections/create` - Friend creates selection
- `POST /api/selections/[id]/mark-paid` - Mark as paid (manual/webhook)

**Security:** All public routes validate `shareToken` before proceeding.

### Key Library Files

**lib/supabase.ts**
- Two clients: `supabaseAdmin` (service role) and `supabase` (anon key)
- Use admin for uploads/writes, anon for public reads
- Functions: `uploadBillImage()`, `getBillImageUrl()`

**lib/claude.ts**
- `analyzeBillImage()` - Sends image to Claude Vision API with German prompt
- Extracts: items array, restaurantName, totalAmount
- Validates URLs (SSRF prevention) and clamps values

**lib/utils.ts**
- `sanitizeInput()` - XSS prevention
- `formatEUR()` - German EUR formatting
- `generatePayPalUrl()` - Builds paypal.me/username/amount URLs
- `calculateTotal()` - Sums selections with multipliers
- `validateImageFile()` - Type/size validation

**lib/billStorage.ts**
- localStorage utilities for bill history (client-side only)
- Stores: billId, shareToken, payerName, createdAt

**lib/selectionStorage.ts**
- localStorage utilities for guest selections (client-side only)
- Supports multiple selections per bill/guest
- Functions: `getSelectionsByToken()`, `saveSelection()`, `deleteSelection()`
- Stores: selectionId, friendName, itemQuantities, amounts, paymentMethod, timestamp
- Dispatches custom events for same-tab updates

**lib/prisma.ts**
- Singleton PrismaClient (prevents multiple instances in dev)

### Component Architecture

**Server Components (default):**
- `/split/[token]/page.tsx` - Public split page (no JS needed)
- `/bills/[id]/status/page.tsx` - Status dashboard

**Redirect Pages (client-side):**
- `/payment-redirect/page.tsx` - Intermediary page that redirects to PayPal (helps keep browser open instead of opening PayPal app)

**Client Components (interactive):**
- `SplitFormContainer` - Container managing guest selections and form display
- `SplitForm` - Item selection with quantity buttons
- `SelectionSummary` - Display all previous selections from localStorage (multiple payments)
- `BillItemsEditor` - Add/edit/delete items (payer only)
- `SelectionCard` - Display individual selection on status page
- `CopyButton`, `RefreshButton` - Interactive controls
- `ThemeProvider`, `ThemeToggle` - Dark mode support

**Pattern:** Minimize client components. Use server components for static/data-heavy pages.

## Important Patterns & Conventions

### 1. Share Token Security
- UUID v4 tokens are unguessable (not sequential IDs)
- Validate token before any bill access
- Example: `bill?.shareToken !== shareToken` → 401

### 2. Supabase Client Usage
- **Admin client** (`supabaseAdmin`): Uploads, database writes
- **Anon client** (`supabase`): Public read-only access
- Never expose service role key to client

### 3. Item Quantities JSON
- Stored as `{"itemId": multiplier}` for flexibility
- Supports: 0 (not selected), 0.5 (half), 1 (full), 2+ (multiple), custom fractions
- Calculate total: `item.pricePerUnit * multiplier` summed across items

### 4. Language & Localization
- All UI text in German
- Error messages in German
- Currency format: EUR with German locale (`de-DE`)
- PayPal URLs include `locale.x=de_DE`

### 5. Edit Protection
- Items can only be modified if `bill.selections.length === 0`
- Prevents changing items after friends have made selections
- API routes enforce this check

### 6. Validation Layers
- **Client:** UX feedback (form validation)
- **Server:** Security (all API routes validate inputs)
- **Database:** Prisma schema constraints

### 7. Dark Mode
- Uses Next.js theme provider with localStorage persistence
- Tailwind `dark:` classes throughout
- Toggle in header

### 8. Image Handling
- Upload: FormData → Supabase Storage → Public URL
- Analysis: Public URL → Base64 → Claude Vision API
- Validation: Type (JPEG/PNG/HEIC), Size (<10MB)

### 9. State Management
- **No Redux/Zustand** - Local React state is sufficient
- Use `useState`, `useEffect` for client components
- Use `localStorage` for persistent data (see below)
- Server components fetch data directly (Prisma)

### 10. Guest Selection Storage (localStorage)
- **Multiple payments per guest:** Guests can make multiple selections/payments for the same bill
- **Automatic persistence:** Each selection is saved to localStorage after successful submission
- **Display on return:** When revisiting the share link, all previous selections are displayed
- **Real-time updates:** Uses custom events (`selectionSaved`) for same-tab updates
- **Storage key:** `guestSelections` in localStorage
- **Data structure:** Array of `SavedSelection` objects with selectionId, amounts, items, timestamp

### 11. Payment Status Terminology
**Important:** The app uses consistent terminology for payment states:
- **"Bezahlt"** = Guest has paid (via PayPal or Cash)
- **"Zahlung bestätigt"** = Owner has confirmed receipt of payment
- UI components: Button says "Zahlung bestätigen", confirmed status shows "✓ Zahlung bestätigt"
- Status dashboard cards: "Bezahlt" (total collected) vs "Zahlung bestätigt" (confirmed by owner)
- Item status labels: "Noch nicht bezahlt", "Bezahlt, nicht bestätigt", "Zahlung bestätigt"

### 12. PayPal Mobile Redirect Strategy
**Problem:** PayPal.me links opened on mobile often trigger the PayPal app, which may not properly prefill the amount.

**Solution:** Intermediary redirect page (`/payment-redirect`)
- Guest submits selection → Redirects to our `/payment-redirect` page (not a universal link)
- Our page opens in browser → Shows countdown + amount
- JavaScript redirect to PayPal → Stays in browser (more reliable amount prefilling)
- URL format: `https://paypal.me/username/25.50` (NO currency code for mobile compatibility)

**Important:** PayPal.me links WITH currency codes (e.g., `/25.50EUR`) work in browsers but fail in mobile app (known bug since March 2024). Always omit currency code.

### 13. Error Handling
- Consistent format: `{ error: "German message" }`
- Log errors server-side for debugging
- User-friendly messages (no stack traces)

## Environment Variables

Required in `.env.local`:

```env
# Claude API
ANTHROPIC_API_KEY=sk-ant-api03-...

# Supabase Database
DATABASE_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres

# Supabase API & Storage
NEXT_PUBLIC_SUPABASE_URL=https://[ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiI...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiI...

# App URL (for share links)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Never commit `.env.local` to git.**

## Common Development Tasks

### Adding a New API Route
1. Create route handler in `app/api/[path]/route.ts`
2. Use `NextRequest`, `NextResponse`
3. Validate inputs (sanitize, check types)
4. Use Prisma for database access
5. Return JSON with error handling

### Adding a New Bill Item Field
1. Update Prisma schema (`prisma/schema.prisma`)
2. Run `npx prisma db push`
3. Run `npx prisma generate`
4. Update Claude prompt in `lib/claude.ts` to extract field
5. Update UI components to display field

### Modifying Claude Vision Prompt
- Edit `lib/claude.ts` → `analyzeBillImage()`
- Prompt is in German (keep consistent)
- Always validate extracted values (clamp, sanitize)
- Return structured `BillAnalysisResult`

### Testing Supabase Changes
- Run `npx ts-node test-supabase-connection.ts`
- Verifies: connection, storage bucket, permissions

## Security Considerations

**Implemented:**
- UUID share tokens (not sequential)
- Input sanitization (XSS prevention)
- File validation (type, size)
- SSRF protection (URL whitelist)
- Prisma ORM (SQL injection prevention)
- Server-side API key storage

**Important:**
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to client
- Always validate `shareToken` on public routes
- Sanitize all user inputs before DB writes
- Validate file uploads (type, size, content)

## Troubleshooting

### Prisma Client Errors
```bash
npx prisma generate  # Regenerate client
```

### Supabase Storage Errors
- Verify bucket `bill-images` exists in Supabase dashboard
- Check storage policies allow public read + authenticated write

### Claude API Errors
- Verify `ANTHROPIC_API_KEY` in `.env.local`
- Ensure image URL is publicly accessible
- Check API quota at console.anthropic.com

### Build Errors
```bash
rm -rf .next && npm run build  # Clear cache and rebuild
```

## Project Structure Reference

```
app/
├── page.tsx                           # Landing page
├── create/page.tsx                    # Create bill form
├── payment-redirect/page.tsx          # PayPal redirect intermediary (keeps browser open)
├── bills/[id]/
│   ├── upload/page.tsx               # Image upload
│   ├── status/page.tsx               # Payer dashboard (server)
├── split/[token]/page.tsx            # Public split page (server)
└── api/
    ├── bills/
    │   ├── create/route.ts
    │   └── [id]/upload/route.ts
    ├── bill-items/
    │   ├── create/route.ts
    │   ├── [id]/route.ts
    └── selections/
        ├── create/route.ts
        └── [id]/mark-paid/route.ts

components/
├── SplitFormContainer.tsx             # Container for split form & selection summary
├── SplitForm.tsx                      # Item selection UI
├── SelectionSummary.tsx               # Display previous guest selections
├── BillItemsEditor.tsx                # Add/edit/delete items
├── SelectionCard.tsx                  # Friend selection display
└── [other UI components]

lib/
├── prisma.ts                          # Database client
├── supabase.ts                        # Storage client
├── claude.ts                          # Vision API
├── utils.ts                           # Helpers
├── billStorage.ts                     # Bill history localStorage utils
└── selectionStorage.ts                # Guest selection localStorage utils

prisma/
└── schema.prisma                      # Database schema
```

## Deployment Notes

### Vercel Deployment

**Platform:** This project is deployed on Vercel and ALL code must be Vercel-compatible.

**Environment Setup:**
- Framework preset: Next.js
- Add all environment variables from `.env.local`
- Update `NEXT_PUBLIC_APP_URL` to Vercel domain
- Run `npx prisma db push` after first deploy

**Vercel-Specific Requirements:**

1. **Suspense Boundaries (Critical)**
   - `useSearchParams()` MUST be wrapped in `<Suspense>` boundary
   - `usePathname()` and `useRouter()` from `next/navigation` may also require Suspense
   - Example pattern:
     ```tsx
     function Content() {
       const searchParams = useSearchParams() // OK here
       return <div>...</div>
     }

     export default function Page() {
       return (
         <Suspense fallback={<Loading />}>
           <Content />
         </Suspense>
       )
     }
     ```

2. **Static vs Dynamic Routes**
   - Server components are pre-rendered by default
   - Use `'use client'` for client-side interactivity
   - Dynamic routes (with params/searchParams) need proper handling
   - Avoid mixing static generation with dynamic runtime features

3. **Serverless Function Limits**
   - API routes run as serverless functions
   - 10-second timeout on Hobby plan, 60s on Pro
   - Keep API routes fast and efficient
   - No long-running processes

4. **Dependencies**
   - All imports must be resolvable at build time
   - Avoid optional dependencies that may not install
   - Check package.json for missing dependencies before deploying

5. **Build Errors**
   - Fix ALL TypeScript errors before deployment
   - Test build locally: `npm run build`
   - Check for missing Suspense boundaries
   - Validate all environment variables are set

**Database:**
- Supabase provides PostgreSQL (free tier: 500MB)
- No migrations - use `prisma db push` for schema changes
- Connection pooling handled by Prisma

**Storage:**
- Supabase Storage bucket: `bill-images` (public read)
- Images served via CDN with caching headers
