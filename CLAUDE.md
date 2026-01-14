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

**RestoBill** is a German-language web application for splitting restaurant bills. Users upload a receipt photo, Claude Vision API analyzes items automatically, and friends select their items via a shareable link to pay through PayPal or cash.

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

**Four main models with cascade delete:**

1. **Bill** - Restaurant bill created by payer
   - Contains: `payerName`, `paypalHandle`, `imageUrl`, `shareToken` (UUID), `restaurantName`, `totalAmount`
   - Relations: `items[]`, `selections[]`, `activeSelections[]`

2. **BillItem** - Individual items on the bill
   - Contains: `name`, `quantity`, `pricePerUnit`, `totalPrice`
   - Belongs to one Bill
   - Relations: `selections[]`, `activeSelections[]`

3. **Selection** - Friend's final item selection (after payment submission)
   - Contains: `friendName`, `itemQuantities` (JSON), `tipAmount`, `paid`, `paymentMethod`, `sessionId`
   - `itemQuantities` format: `{"itemId": multiplier}` (e.g., `{"uuid": 0.5}` for half portion)
   - `paymentMethod`: PAYPAL or CASH (enum)
   - `sessionId`: Browser session identifier (UUID, optional for future features)
   - Belongs to one Bill, references multiple BillItems

4. **ActiveSelection** - Temporary live selections (real-time tracking)
   - Contains: `billId`, `itemId`, `sessionId`, `guestName`, `quantity`, `expiresAt`
   - Tracks guest selections in real-time BEFORE they submit payment
   - Expires after 30 minutes (automatic cleanup)
   - Unique constraint: `[billId, itemId, sessionId]` (one entry per item per browser session)
   - Used for live payment overview dashboard

**Payment Methods Enum:**
- `PAYPAL` - Payment via PayPal.me link
- `CASH` - Cash payment (guest notifies payer, no redirect)

**Important:**
- Items can only be edited/deleted if no selections exist yet
- ActiveSelections are temporary and auto-expire (cleaned up via `/api/live-selections/cleanup`)
- Sessions are tracked per browser using unique sessionId (stored in localStorage)

### Application Flow

**Payer Flow:**
1. Create bill → `POST /api/bills/create` → Get billId + shareToken
2. Upload image → `POST /api/bills/[id]/upload` → Claude analyzes items
3. Review items → `/bills/[id]/review` → View analyzed items, share link with QR code
4. Edit items (optional) → API routes in `/api/bill-items/` (only if no selections exist)
5. Share link with friends → `/split/[shareToken]` (via link copy, WhatsApp, or QR code)
6. Monitor status → `/bills/[id]/status` → See live selections and payment progress

**Friend Flow (PayPal):**
1. Open share link → Server-rendered page with bill data
2. View previous selections (if any) from localStorage
3. Enter name → Session tracked via unique sessionId (browser-specific)
4. Select items with quantities (0, 0.5, 1, 2, custom fractions)
   - Live selections tracked in ActiveSelection table (visible to payer in real-time)
5. Add tip (0%, 7%, 10%, 15%, or custom)
6. Choose payment method: PayPal or Cash
7. Submit → `POST /api/selections/create` → Selection saved to database & localStorage
8. **PayPal:** Redirect to `/payment-redirect` page → Auto-redirect to PayPal.me (stays in browser)
9. Can return and make additional selections (multiple payments per guest supported)

**Friend Flow (Cash):**
1-7. Same as PayPal flow
8. **Cash:** Redirect to `/split/[token]/cash-confirmed` → Confirmation page with payment instructions
9. Guest pays cash directly to payer (no online payment needed)

### API Routes Structure

All routes follow RESTful patterns:

**Bill Management:**
- `POST /api/bills/create` - Create bill with payer info
- `POST /api/bills/[id]/upload` - Upload & analyze image
- `GET /api/bills/[id]/items` - Get all items for a bill
- `GET /api/bills/[id]/selections` - Get all selections for a bill
- `GET /api/bills/[id]/live-selections` - Get active (live) selections for a bill

**Bill Items:**
- `POST /api/bill-items/create` - Add item manually
- `PUT /api/bill-items/[id]` - Edit item (only if no selections)
- `DELETE /api/bill-items/[id]` - Delete item (only if no selections)

**Selections (Final Payments):**
- `POST /api/selections/create` - Friend creates selection (PayPal or Cash)
- `POST /api/selections/[id]/mark-paid` - Mark as paid (manual confirmation by payer)
- `GET /api/selections/owner` - Owner-specific selection data

**Live Selections (Real-time Tracking):**
- `POST /api/live-selections/update` - Update/create active selection (real-time tracking)
- `POST /api/live-selections/cleanup` - Clean up expired active selections

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

**lib/sessionStorage.ts**
- Browser session management for unique user identification
- Functions: `getOrCreateSessionId()`, `getSessionId()`, `clearSessionId()`
- Generates UUID v4 per browser (persists across page reloads)
- Used for ActiveSelection tracking (prevents duplicate entries from same browser)

**lib/hooks/useRealtimeSubscription.ts**
- Centralized Supabase Realtime subscription hook
- Connection monitoring with automatic reconnection (exponential backoff)
- Event handlers: onSelectionChange, onActiveSelectionChange, onItemChange
- Returns: isConnected, connectionStatus, reconnect()
- Used by: PaymentOverview, SplitForm, SplitFormContainer

**lib/prisma.ts**
- Singleton PrismaClient (prevents multiple instances in dev)

### Component Architecture

**Server Components (default):**
- `/split/[token]/page.tsx` - Public split page (no JS needed)
- `/split/[token]/cash-confirmed/page.tsx` - Cash payment confirmation page
- `/bills/[id]/status/page.tsx` - Status dashboard with real-time updates
- `/bills/[id]/review/page.tsx` - Review analyzed items after upload

**Redirect Pages (client-side):**
- `/payment-redirect/page.tsx` - Intermediary page that redirects to PayPal (helps keep browser open instead of opening PayPal app)

**Client Components (interactive):**
- `SplitFormContainer` - Container managing guest selections and form display (uses useRealtimeSubscription)
- `SplitForm` - Item selection with quantity buttons, live selection tracking (uses useRealtimeSubscription)
- `SelectionSummary` - Display all previous selections from localStorage (multiple payments)
- `PaymentOverview` - Real-time payment dashboard with live selections (uses useRealtimeSubscription)
- `BillItemsEditor` - Add/edit/delete items (payer only)
- `SelectionCard` - Display individual selection on status page
- `ShareLink` - Share link with copy button and WhatsApp integration
- `QRCode` - QR code generator for share links (uses react-qr-code)
- `CollapsibleReceipt` - Expandable receipt image view
- `BillsList` - List of bill history
- `BillAutoSave` - Auto-save functionality for bill drafts
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

### 14. Session-based Tracking
- Each browser gets unique sessionId (UUID v4) stored in localStorage
- Generated via `getOrCreateSessionId()` from `lib/sessionStorage.ts`
- Used for:
  - ActiveSelection unique constraint (prevents duplicate entries per browser)
  - Future feature: "My Bills" page to show user's selections across devices
- Persists across page reloads but unique per browser
- Optional field in Selection model for future use

### 15. Live Selections (Real-time Tracking)
**Purpose:** Show payer which items guests are currently selecting BEFORE payment submission

**How it works:**
- Guest enters name and selects items → `POST /api/live-selections/update` called in real-time
- Creates/updates ActiveSelection entries (unique per billId + itemId + sessionId)
- Payer sees live updates in PaymentOverview component on status page
- Uses **Supabase Realtime ONLY** (WebSocket-based) - no polling!
- Automatic reconnection with exponential backoff if connection drops
- Entries expire after 30 minutes (cleanup via `/api/live-selections/cleanup`)

**Data flow:**
1. SplitForm tracks quantity changes → Updates ActiveSelection via API
2. PaymentOverview subscribes to ActiveSelection changes via WebSocket
3. Instant updates (< 100ms latency) when changes occur
4. Displays "Ausgewählt" total with live indicator (blue pulse dot)
5. When guest submits payment → ActiveSelection converted to Selection (final)

**Benefits:**
- Instant updates (< 100ms vs 3s with polling)
- 99% less server requests (WebSocket vs HTTP polling)
- Scales to 100+ concurrent users without performance issues
- Payer sees real-time progress (who's selecting what)
- Prevents over-selection (guests see what others selected)
- Better UX for large groups

### 16. Cash Payment Flow
**Why:** Not everyone has PayPal - cash option provides flexibility

**Flow:**
1. Guest selects items, adds tip, chooses "Barzahlung" option
2. Submits → `POST /api/selections/create` with `paymentMethod: CASH`
3. Redirects to `/split/[token]/cash-confirmed` (NOT payment-redirect)
4. Confirmation page shows:
   - Payment method: 💵 Barzahlung
   - Amount to pay in cash
   - Instructions to pay payer directly
5. Selection saved as `paid: false` initially
6. Payer manually confirms payment via "Zahlung bestätigen" button on status page

**Important:**
- No external redirect (unlike PayPal flow)
- Manual confirmation required by payer
- paymentMethod field distinguishes CASH from PAYPAL in Selection model

### 17. Share Link Features
**Purpose:** Make sharing bills with friends as easy as possible

**ShareLink Component Features:**
1. **Copy to Clipboard**
   - One-click copy of share URL
   - Visual feedback ("✓ Kopiert!" for 2 seconds)
   - Uses `navigator.clipboard.writeText()`

2. **WhatsApp Integration**
   - One-click share via WhatsApp Web/App
   - Pre-formatted message in German with share link
   - Opens WhatsApp with `https://wa.me/?text=...`

3. **QR Code Generator**
   - Displays on `/bills/[id]/review` page
   - Uses `react-qr-code` library (QRCodeSVG component)
   - Level "H" (high) error correction
   - Configurable size (default 200px)
   - Friends can scan QR code to open split page instantly

**Usage Pattern:**
- Review page shows: Copy button + WhatsApp button + QR code
- All three methods open same share link: `/split/[shareToken]`
- QR codes especially useful for in-person bill splitting (restaurant table)

### 18. Realtime Subscription Hook (useRealtimeSubscription)
**Purpose:** Centralized Supabase Realtime management with connection monitoring and automatic reconnection

**Location:** `lib/hooks/useRealtimeSubscription.ts`

**Features:**
- ✅ Single unified channel per bill (`bill:${billId}`) - no duplicate subscriptions
- ✅ Singleton Supabase client with `persistSession: false` (prevents multiple GoTrueClient instances)
- ✅ React Strict Mode compatible (ignores CLOSED status during active subscription)
- ✅ Connection status tracking (CONNECTING, CONNECTED, DISCONNECTED, RECONNECTING)
- ✅ Automatic reconnection with exponential backoff (1s, 2s, 4s... max 30s)
- ✅ Initial data fetch on mount and after reconnection
- ✅ Subscriptions for Selection, ActiveSelection, and broadcast events
- ✅ Error handling and optional debug logging
- ✅ Automatic cleanup on unmount

**Usage Example:**
```typescript
const { isConnected, connectionStatus } = useRealtimeSubscription(billId, {
  // Initial data fetch
  onInitialFetch: async () => {
    await fetchSelections()
    await fetchActiveSelections()
  },

  // Event handlers
  onSelectionChange: () => fetchSelections(),
  onActiveSelectionChange: () => fetchActiveSelections(),
  onItemChange: () => fetchItems(),

  // Optional callbacks
  onConnectionStatusChange: (status) => console.log(status),
  onError: (error) => console.error(error),

  // Enable debug logging (development only)
  debug: process.env.NODE_ENV === 'development'
})
```

**Components using this hook:**
- `PaymentOverview.tsx` - Subscribes to Selection and ActiveSelection changes
- `SplitForm.tsx` - Subscribes to ActiveSelection, Selection, and item-changed broadcasts
- `SplitFormContainer.tsx` - Subscribes to Selection and item-changed broadcasts

**Connection Status:**
- `CONNECTING` - Initial connection attempt
- `CONNECTED` - WebSocket connected and subscribed
- `DISCONNECTED` - Connection lost (triggers reconnection)
- `RECONNECTING` - Attempting to reconnect with backoff

**Benefits over polling:**
- 99% less HTTP requests (one WebSocket vs 20 requests/minute per user)
- Instant updates (< 100ms vs 0-3s polling delay)
- Automatic reconnection if WiFi drops
- Better battery life on mobile devices
- Scales to 100+ concurrent users

**Implementation Notes:**
- Uses singleton pattern for Supabase client (prevents multiple instances)
- `persistSession: false` disables auth session persistence (not needed for realtime-only)
- `isSubscribingRef` flag prevents concurrent subscriptions (React Strict Mode fix)
- CLOSED status ignored during active subscription to prevent reconnection loops
- Initial data fetch happens both on mount and after successful reconnection
- All realtime subscriptions use same channel name: `bill:${billId}`
- PostgreSQL filter applied: `filter: 'billId=eq.${billId}'` for efficiency

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

### Working with Live Selections (Real-time Features)
**When adding/modifying real-time tracking:**
1. Update `ActiveSelection` model in `prisma/schema.prisma` if schema changes needed
2. Run `npx prisma db push` to sync database
3. Update `/api/live-selections/update` route if API changes needed
4. Update `SplitForm.tsx` quantity handlers to call live-selections API
5. Update `useRealtimeSubscription` hook if new event types needed
6. Update components using the hook (PaymentOverview, SplitForm, SplitFormContainer)
7. Test with multiple browser windows to verify real-time sync

**Important:**
- ActiveSelections expire after 30 minutes (set in `expiresAt` field)
- Cleanup happens via `/api/live-selections/cleanup` (can be run as cron job)
- Unique constraint: `[billId, itemId, sessionId]` prevents duplicates per browser
- Uses **Realtime ONLY** (no polling) - WebSocket must be enabled in Supabase
- All realtime logic is centralized in `useRealtimeSubscription` hook
- Automatic reconnection with exponential backoff if connection drops

**Adding new realtime event types:**
1. Add new callback to `RealtimeEventHandlers` interface in hook
2. Add corresponding `.on()` subscription in hook's `subscribe()` function
3. Use the new callback in components via hook options

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

### Real-time/Live Selection Issues
**Symptoms:** Live selections not updating, stale data, or missing updates

**Common causes and fixes:**
1. **Supabase Realtime not enabled**
   - Check Supabase dashboard → Database → Replication
   - Enable realtime for `ActiveSelection` and `Selection` tables
   - Run SQL to enable: `ALTER PUBLICATION supabase_realtime ADD TABLE "ActiveSelection";`
   - Verify with: `SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';`
   - Realtime is REQUIRED (no polling fallback anymore)

2. **WebSocket connection failing**
   - Check browser console for connection errors
   - Look for `[Realtime]` debug messages (if debug: true)
   - Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set
   - Realtime requires WebSocket support (check browser compatibility)
   - Check if corporate firewall/proxy blocks WebSocket connections

3. **Connection status stuck in RECONNECTING**
   - Check network tab for failed WebSocket upgrade requests
   - Verify Supabase project is active (not paused)
   - Clear browser cache and reload
   - Check Supabase status page for outages

4. **ActiveSelections not cleaning up**
   - Manually run cleanup: `POST /api/live-selections/cleanup`
   - Set up Vercel Cron Job to run cleanup every 10 minutes
   - Check `expiresAt` timestamps are being set correctly

5. **Duplicate entries per browser**
   - Verify sessionId is consistent across component re-renders
   - Check localStorage for `userSessionId` key
   - Clear localStorage and refresh to generate new sessionId

6. **React Strict Mode causing connection loops**
   - Symptom: Channels repeatedly CLOSED → RECONNECTING → CONNECTED
   - Cause: React Strict Mode double-mounts components in development
   - Solution: Hook already handles this with `isSubscribingRef` flag
   - Hook ignores CLOSED status during active subscription setup
   - Singleton Supabase client prevents multiple GoTrueClient warnings

**Debug tips:**
- Enable debug mode: `debug: process.env.NODE_ENV === 'development'` in hook
- Check browser console for `[Realtime]` messages
- Monitor connection status: `connectionStatus` from hook
- Open PaymentOverview in one window, SplitForm in another (same bill)
- Watch Network tab for WebSocket connection (wss://)
- Check Supabase Table Editor for ActiveSelection entries
- Test reconnection: Turn WiFi off/on and watch reconnection attempts

**Testing realtime connection:**
```typescript
// In any component using the hook
const { isConnected, connectionStatus, reconnect } = useRealtimeSubscription(billId, {
  onConnectionStatusChange: (status) => {
    console.log('Connection status:', status)
  },
  onError: (error) => {
    console.error('Realtime error:', error)
  },
  debug: true
})

// Display connection status in UI (optional)
{!isConnected && <div>⚠️ Verbindung getrennt... Versuche Neuverbindung</div>}
```

## Project Structure Reference

```
app/
├── page.tsx                           # Landing page
├── create/page.tsx                    # Create bill form
├── payment-redirect/page.tsx          # PayPal redirect intermediary (keeps browser open)
├── bills/[id]/
│   ├── upload/page.tsx               # Image upload
│   ├── review/page.tsx               # Review analyzed items with share link
│   └── status/page.tsx               # Payer dashboard with live updates
├── split/[token]/
│   ├── page.tsx                      # Public split page (server)
│   └── cash-confirmed/page.tsx       # Cash payment confirmation
├── test-supabase/page.tsx            # Supabase connection test page
└── api/
    ├── bills/
    │   ├── create/route.ts           # Create new bill
    │   └── [id]/
    │       ├── upload/route.ts       # Upload & analyze receipt
    │       ├── items/route.ts        # Get all items for bill
    │       ├── selections/route.ts   # Get all selections for bill
    │       └── live-selections/route.ts  # Get active selections
    ├── bill-items/
    │   ├── create/route.ts           # Add item manually
    │   └── [id]/route.ts             # Edit/delete item (PUT/DELETE)
    ├── selections/
    │   ├── create/route.ts           # Create selection (PayPal/Cash)
    │   ├── owner/route.ts            # Owner-specific data
    │   └── [id]/mark-paid/route.ts   # Confirm payment received
    ├── live-selections/
    │   ├── update/route.ts           # Update active selection (realtime)
    │   └── cleanup/route.ts          # Clean up expired selections
    └── test-supabase/route.ts        # Test Supabase connection

components/
├── SplitFormContainer.tsx             # Container for split form & selection summary
├── SplitForm.tsx                      # Item selection UI with live tracking
├── SelectionSummary.tsx               # Display previous guest selections
├── PaymentOverview.tsx                # Real-time payment dashboard
├── BillItemsEditor.tsx                # Add/edit/delete items (owner only)
├── SelectionCard.tsx                  # Display individual selection
├── ShareLink.tsx                      # Share link with copy & WhatsApp
├── QRCode.tsx                         # QR code generator
├── CollapsibleReceipt.tsx             # Expandable receipt image
├── BillsList.tsx                      # Bill history list
├── BillAutoSave.tsx                   # Auto-save functionality
├── CopyButton.tsx                     # Copy to clipboard button
├── RefreshButton.tsx                  # Refresh data button
├── ThemeProvider.tsx                  # Dark mode provider
└── ThemeToggle.tsx                    # Dark mode toggle

lib/
├── hooks/
│   ├── useRealtimeSubscription.ts    # Centralized Supabase Realtime hook
│   └── index.ts                       # Hooks barrel export
├── prisma.ts                          # Database client (singleton)
├── supabase.ts                        # Storage client (admin + anon)
├── claude.ts                          # Vision API integration
├── utils.ts                           # Helpers (formatEUR, sanitize, etc.)
├── billStorage.ts                     # Bill history localStorage utils
├── selectionStorage.ts                # Guest selection localStorage utils
└── sessionStorage.ts                  # Session ID management (browser tracking)

prisma/
└── schema.prisma                      # Database schema (Bill, BillItem, Selection, ActiveSelection)
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
