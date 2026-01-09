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

**Tech Stack:** Next.js 14 (App Router), TypeScript, Prisma (dev only), Supabase (PostgreSQL + Storage), Claude Vision API, Tailwind CSS

**⚠️ CRITICAL:** Prisma does NOT work with Vercel deployment. Use Supabase client directly for production API routes.

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

**Four main models with cascade delete:**

1. **Bill** - Restaurant bill created by payer
   - Contains: `payerName`, `paypalHandle`, `imageUrl`, `shareToken` (UUID), `googlePlaceId` (optional)
   - Relations: `items[]`, `selections[]`, `reviews[]`

2. **BillItem** - Individual items on the bill
   - Contains: `name`, `quantity`, `pricePerUnit`, `totalPrice`
   - Belongs to one Bill

3. **Selection** - Friend's item selection
   - Contains: `friendName`, `itemQuantities` (JSON), `tipAmount`, `paid`, `reviewed` (boolean)
   - `itemQuantities` format: `{"itemId": multiplier}` (e.g., `{"uuid": 0.5}` for half portion)
   - Belongs to one Bill, references multiple BillItems

4. **Review** - Post-payment guest feedback
   - Contains: `sentiment` (enum), `isPositive` (boolean), `googleReviewClicked` (boolean), `internalFeedback` (text)
   - Belongs to one Bill, references one Selection (optional)
   - Tracks: Guest satisfaction and Google review conversion

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
6. Redirect to PayPal for payment
7. Can return and make additional selections (multiple payments per guest supported)

### API Routes Structure

All routes follow RESTful patterns:

- `POST /api/bills/create` - Create bill with payer info
- `POST /api/bills/[id]/upload` - Upload & analyze image
- `POST /api/bill-items/create` - Add item manually
- `PUT /api/bill-items/[id]` - Edit item (only if no selections)
- `DELETE /api/bill-items/[id]` - Delete item (only if no selections)
- `POST /api/selections/create` - Friend creates selection
- `POST /api/selections/[id]/mark-paid` - Mark as paid (manual/webhook)
- `POST /api/reviews` - Submit post-payment review (sentiment + feedback)

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

### 12. Review Feature (Post-Payment Feedback)
**Architecture:** Guests can rate their experience after paying, with sentiment-based routing.

**Flow:**
1. Guest completes payment (Cash or PayPal)
2. When returning to `/split/[token]`, app checks for unreviewed selections in localStorage
3. If unreviewed selection exists → Show ReviewFlow modal/component
4. Guest selects sentiment: 😍 Super, 😊 Gut, 😐 Okay, 😕 Mäßig, 😞 Schlecht
5. **Positive (Super/Gut):** Show Google Review button (if `googlePlaceId` exists)
6. **Negative (Okay/Mäßig/Schlecht):** Show internal feedback form
7. Submit review → `POST /api/reviews` → Mark selection as `reviewed: true`

**Data Model:**
- **Review** table: Stores sentiment, Google click tracking, internal feedback
- **Bill.googlePlaceId** (optional): For Google Places deep link
- **Selection.reviewed** (boolean): Tracks if selection has been reviewed

**Key Decisions:**
- Review offered **once per guest per bill** (even if multiple selections/payments)
- Review always shown (not conditional on amount)
- Google Place ID comes from future restaurant registration (B2B)
- PayPal returns manually (no callback URL with paypal.me)

**Google Review Deep Link:**
```
https://search.google.com/local/writereview?placeid={googlePlaceId}
```

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

**⚠️ CRITICAL - Prisma + Vercel Issue:**
- **Prisma does NOT work reliably with Vercel** (serverless functions)
- **Solution:** Use `supabaseAdmin` client directly in API routes for production
- Prisma is OK for local development (`npm run dev`)
- Schema management: Use Prisma for migrations, but query via Supabase client

**Vercel:**
- Framework preset: Next.js
- Add all environment variables from `.env.local`
- Update `NEXT_PUBLIC_APP_URL` to Vercel domain
- **Do NOT rely on Prisma Client in production API routes**

**Database:**
- Supabase provides PostgreSQL (free tier: 500MB)
- Schema changes: Update `prisma/schema.prisma` then `npx prisma db push`
- **Production queries:** Use `supabaseAdmin.from('Table')` instead of `prisma.table`
- Local dev: Prisma Client works fine via `npx prisma generate`

**Storage:**
- Supabase Storage bucket: `bill-images` (public read)
- Images served via CDN with caching headers
