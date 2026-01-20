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

**RestoBill** is a German-language web application for splitting restaurant bills. Users upload a receipt photo, Claude Vision API analyzes items automatically, and friends select their items via a shareable link to pay through PayPal or cash. After payment, guests are encouraged to leave Google reviews for the restaurant.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Prisma, Supabase (PostgreSQL + Storage), Claude Vision API, Google Places API (New), Tailwind CSS

**Deployment:** Vercel (ALL code must be Vercel-compatible - see Deployment Notes section)

## ⚠️ CRITICAL: GIT WORKFLOW ⚠️

**!!!!! NEVER COMMIT OR PUSH CODE !!!!!**

**NEVER use git commit, git push, or any git commands that modify the repository!**

- ❌ **FORBIDDEN:** `git commit`, `git push`, `git add`, `git merge`, `git rebase`
- ✅ **ALLOWED:** `git status`, `git diff`, `git log` (read-only commands)
- 👤 **USER ONLY:** All commits and pushes are done MANUALLY by the user
- 🚫 **NO EXCEPTIONS:** Even for "small fixes" or "urgent deployments"

**Why:**
- User wants full control over git history
- User reviews all changes before committing
- User decides when and what to deploy
- Prevents accidental deployments to production

**If changes need to be deployed:**
1. Tell the user what files were changed
2. User will review changes
3. User will commit and push manually
4. You can suggest commit messages, but never execute them

## Core Principle: KISS (Keep It Simple, Stupid)

- Favor simplicity over complexity
- Avoid over-engineering and premature abstractions
- Only add features when explicitly needed
- Keep code readable and maintainable
- No unnecessary dependencies or patterns

## Critical: Database Access in API Routes

**ALWAYS use Supabase Admin Client, NEVER use Prisma in API routes!**

```typescript
// ✅ CORRECT - Use Supabase Admin Client
import { supabaseAdmin } from '@/lib/supabase'
const { data, error } = await supabaseAdmin.from('Table').select('*')

// ❌ WRONG - Do NOT use Prisma in API routes
import { prisma } from '@/lib/prisma'
const data = await prisma.table.findMany()
```

**Why:**
- Prisma has connection issues with Vercel Serverless Functions (cold starts, timeouts)
- Supabase Admin Client is optimized for serverless environments
- ALL existing API routes use `supabaseAdmin` - maintain consistency
- Prevents "Can't reach database server" errors on Vercel

**Where to use Prisma:**
- Schema definition (`prisma/schema.prisma`)
- Database migrations (`npx prisma db push`)
- Type generation (`npx prisma generate`)

**Where to use Supabase Admin Client:**
- ALL API routes (`app/api/**/*.ts`)
- Server-side data fetching in pages (if not using Supabase directly)

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

**Five main models with cascade delete:**

1. **Bill** - Restaurant bill created by payer
   - Contains: `payerName`, `paypalHandle`, `imageUrl`, `shareToken` (UUID), `restaurantName`, `totalAmount`
   - **Google Places Integration:** `restaurantAddress`, `googlePlaceId`, `googleMapsUrl`, `reviewUrl`
   - Relations: `items[]`, `selections[]`, `feedback[]`

2. **BillItem** - Individual items on the bill
   - Contains: `name`, `quantity`, `pricePerUnit`, `totalPrice`
   - Belongs to one Bill
   - Relations: `selections[]`, `activeSelections[]`

3. **Selection** - Unified table for guest selections (status always SELECTING)
   - Contains: `friendName`, `itemQuantities` (JSON), `tipAmount`, `paid`, `paymentMethod`, `sessionId`, `status`
   - `itemQuantities` format: `{"itemId": multiplier}` (e.g., `{"uuid": 0.5}` for half portion)
   - `status`: **ALWAYS** 'SELECTING' (never changes to PAID)
   - `paid`: Boolean flag - false=submitted, true=confirmed by payer
   - `paymentMethod`: PAYPAL or CASH (enum)
   - `sessionId`: Browser session identifier (UUID, required)
   - Belongs to one Bill, references multiple BillItems
   - **All selections:** status=SELECTING, expires after 30 days (allows multi-day bill splitting)
   - **Payment confirmation:** Uses `paid` flag (true/false), NOT status change
   - **Unique constraint:** Partial index on (billId, sessionId) WHERE status='SELECTING' (only one selection per session)

4. **RestaurantFeedback** - Guest feedback for restaurants
   - Contains: `rating` (1=😞, 2=😐, 3=😊), `feedbackText`, `sessionId`, `friendName`
   - `rating`: 1 (schlecht), 2 (mittel), 3 (top)
   - `feedbackText`: Personal feedback (only for rating 1 or 2, null for rating 3)
   - `sessionId`: Browser session identifier (tracks which guest gave feedback)
   - `friendName`: Optional guest name
   - Belongs to one Bill
   - **Purpose:** Collect positive Google reviews (rating 3) or constructive feedback (rating 1-2) for restaurant improvement
   - One feedback per session per bill (can be updated)

**Payment Methods Enum:**
- `PAYPAL` - Payment via PayPal.me link
- `CASH` - Cash payment (guest notifies payer, no redirect)

**Important:**
- Items can only be edited/deleted if no selections exist yet
- All selections (status=SELECTING) persist in database for 30 days
- Sessions are tracked per browser using unique sessionId (stored in localStorage)
- Multiple payments per guest NOT supported (unique constraint per session)
- Payment confirmation uses `paid` flag, NOT status change

### Application Flow

**Payer Flow:**
1. Create bill → `POST /api/bills/create` → Get billId + shareToken
2. Upload image → `POST /api/bills/[id]/upload` → Claude analyzes items + address → Google Places finds restaurant → Review URL generated
3. Status page → `/bills/[id]/status` → View analyzed items, share link with QR code, Google review link, monitor payments
4. Edit items (optional) → API routes in `/api/bill-items/` (editable at any time)
5. Share link with friends → `/split/[shareToken]` (via link copy, WhatsApp, or QR code)

**Friend Flow (PayPal):**
1. Open share link → Server-rendered page with bill data
2. View previous selection (if any) from database (via sessionId)
3. Enter name → Session tracked via unique sessionId (browser-specific)
4. Select items with quantities (0, 0.5, 1, 2, custom fractions)
   - Live selections tracked in Selection table (status=SELECTING, visible to payer in real-time)
5. Add tip (0%, 7%, 10%, 15%, or custom)
6. Choose payment method: PayPal or Cash
7. Submit → `POST /api/selections/create` → Selection saved (status=SELECTING, paid=false)
8. **PayPal:** Redirect to `/payment-redirect` page → Auto-redirect to PayPal.me (stays in browser)
9. **Restaurant Feedback (optional):**
   - Select rating (😞 schlecht, 😐 mittel, 😊 top)
   - Rating 3 (😊) → Show Google review link (if reviewUrl exists)
   - Rating 1-2 → Show textarea for personal feedback → `POST /api/feedback/create`
10. Payer manually confirms payment via `/api/selections/[id]/mark-paid` (sets paid=true)

**Friend Flow (Cash):**
1-7. Same as PayPal flow (status remains SELECTING, paid=false)
8. **Cash:** Redirect to `/split/[token]/cash-confirmed` → Confirmation page with payment instructions
9. **Restaurant Feedback (optional):** Same as PayPal flow
10. Guest pays cash directly to payer
11. Payer manually confirms payment (sets paid=true)

### API Routes Structure

All routes follow RESTful patterns:

**Bill Management:**
- `POST /api/bills/create` - Create bill with payer info
- `POST /api/bills/[id]/upload` - Upload & analyze image
- `GET /api/bills/[id]/items` - Get all items for a bill
- `GET /api/bills/[id]/live-selections` - Get all selections for a bill (status=SELECTING, not expired)

**Bill Items:**
- `POST /api/bill-items/create` - Add item manually
- `PUT /api/bill-items/[id]` - Edit item (only if no selections)
- `DELETE /api/bill-items/[id]` - Delete item (only if no selections)

**Selections:**
- `POST /api/selections/create` - Guest submits payment (status=SELECTING, paid=false)
- `POST /api/selections/[id]/mark-paid` - Payer confirms payment (sets paid=true, status remains SELECTING)
- `DELETE /api/selections/[id]/mark-paid` - Payer unconfirms payment (sets paid=false)
- `GET /api/selections/owner` - Owner-specific selection data
- `GET /api/selections/session` - Get selection for a specific browser session (sessionId)

**Live Selections (Real-time Tracking):**
- `GET /api/bills/[id]/live-selections` - Get all selections for a bill (PRIMARY endpoint, works reliably on Vercel)
- `POST /api/live-selections/update` - Update/create selection during item selection (before submit)
- `POST /api/live-selections/update-tip` - Update tip amount only
- `POST /api/live-selections/cleanup` - Clean up expired selections (30+ days old)

**Restaurant Feedback:**
- `POST /api/feedback/create` - Save guest feedback (rating + optional text)

**Note:** The `/api/bills/[id]/selections` endpoint was deprecated due to issues on Vercel. Use `/live-selections` instead.

**Security:** All public routes validate `shareToken` before proceeding.

### Key Library Files

**lib/supabase.ts**
- Two clients: `supabaseAdmin` (service role) and `supabase` (anon key)
- Use admin for uploads/writes, anon for public reads
- Functions: `uploadBillImage()`, `getBillImageUrl()`

**lib/claude.ts**
- `analyzeBillImage()` - Sends image to Claude Vision API with German prompt
- Extracts: items array, restaurantName, totalAmount, restaurantAddress
- Validates URLs (SSRF prevention) and clamps values

**lib/googlePlaces.ts**
- `searchRestaurant()` - Searches restaurant on Google Maps via Text Search API
- Takes: restaurantName, restaurantAddress (optional)
- Returns: placeId, googleMapsUrl, reviewUrl, formattedAddress, rating, photoUrl
- Automatically called during bill upload if restaurant name found
- Non-blocking: App continues if Google Places API fails

**lib/utils.ts**
- `sanitizeInput()` - XSS prevention
- `formatEUR()` - German EUR formatting
- `generatePayPalUrl()` - Builds paypal.me/username/amount URLs
- `calculateTotal()` - Sums selections with multipliers
- `validateImageFile()` - Type/size validation

**lib/billStorage.ts**
- localStorage utilities for bill history (client-side only)
- Stores: billId, shareToken, payerName, createdAt

**lib/sessionStorage.ts**
- Browser session management for unique user identification
- Functions: `getOrCreateSessionId()`, `getSessionId()`, `clearSessionId()`
- Generates UUID v4 per browser (persists across page reloads)
- Used for ActiveSelection tracking (prevents duplicate entries from same browser)

**lib/broadcast.ts**
- Utilities for sending Supabase Realtime broadcasts
- Functions: `sendBroadcast()`, `broadcastItemChange()`
- Handles channel subscription, broadcast sending, and cleanup
- Used by API routes to notify clients of item changes (create/update/delete)
- Ensures broadcasts are delivered reliably with proper channel lifecycle management

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

**Redirect Pages (client-side):**
- `/payment-redirect/page.tsx` - Intermediary page that redirects to PayPal (helps keep browser open instead of opening PayPal app)

**Client Components (interactive):**
- `SplitFormContainer` - Container managing guest selections and form display (uses useRealtimeSubscription)
- `SplitForm` - Item selection with quantity buttons, live selection tracking, editable name display (uses useRealtimeSubscription)
- `SelectionSummary` - Display all previous selections from database via sessionId (multiple payments)
- `GuestSelectionsList` - Accordion-based guest list with collapsible details, payment confirmation buttons (payer only)
- `BillItemsEditor` - Add/edit/delete items (payer only)
- `SelectionCard` - Display individual selection on status page
- `ShareLink` - Share link with copy button, WhatsApp integration, and review link (standalone component, used in split page)
- `WhatsAppShareButton` - WhatsApp share button with optional review text
- `ReviewLinkSection` - Google review link copy section (displayed when restaurant found)
- `RestaurantFeedback` - Restaurant feedback with 3 smiley ratings (😞 schlecht, 😐 mittel, 😊 top), Google review link for rating 3, textarea for rating 1-2
- `QRCode` - QR code generator for share links (uses react-qr-code)
- `CollapsibleReceipt` - Expandable receipt image view
- `BillsList` - List of bill history
- `BillAutoSave` - Auto-save functionality for bill drafts
- `CopyButton`, `RefreshButton` - Interactive controls
- `ThemeProvider` - Enforces dark mode globally
- `StatusPageClient` - Status dashboard container (removed PaymentOverview, uses GuestSelectionsList)
- `EditableGuestName` - Editable guest name component (localStorage only, for guests)
- `EditablePayerName` - Editable payer name component (DB + localStorage, for owner)

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
- **REMOVED** - Owner can always edit/delete items, even if selections exist
- Guests' selections adjust automatically when items change
- Deleted items are handled gracefully in frontend (item won't render if it doesn't exist)

### 6. Validation Layers
- **Client:** UX feedback (form validation)
- **Server:** Security (all API routes validate inputs)
- **Database:** Prisma schema constraints

### 7. Dark Mode
- Application is dark mode only (no light mode support)
- ThemeProvider enforces dark mode globally on mount
- Tailwind `dark:` classes used throughout for styling

### 8. Image Handling
- Upload: FormData → Supabase Storage → Public URL
- Analysis: Public URL → Base64 → Claude Vision API
- Validation: Type (JPEG/PNG/HEIC), Size (<10MB)

### 9. State Management
- **No Redux/Zustand** - Local React state is sufficient
- Use `useState`, `useEffect` for client components
- **Single Source of Truth: Database** - All critical data (selections, items) stored in Supabase
- localStorage only for UI preferences (theme, autocomplete names)
- Server components fetch data directly (Prisma)

### 10. Guest Selection Storage (Database)
- **Multiple payments per guest:** Guests can make multiple selections/payments for the same bill
- **Database persistence:** Each selection is saved to Selection table via API
- **Display on return:** When revisiting the share link, selections are loaded from DB via sessionId
- **Real-time updates:** Uses Supabase Realtime (WebSocket) for instant updates across all users
- **No localStorage:** All selection data comes from database (single source of truth)
- **Session tracking:** Guest selections are filtered by sessionId (unique per browser)

### 11. Owner Selection Filtering (Remaining Quantities)
**CRITICAL:** Owner's own live selection must be excluded from remaining quantity calculations to allow free selection changes.

**Problem:** If owner's own selection is counted in "claimed" quantities, buttons become disabled after first selection.
- Example: Item has quantity 2 → Owner selects 1x → remaining becomes 1 (2-1) → 2x button disabled ❌

**Solution:** Filter out owner's own live selection in both `StatusPageClient` and `SplitForm`:

**StatusPageClient.tsx:**
```typescript
// Get owner's sessionId from localStorage
const ownerSessionId = localStorage.getItem('userSessionId')

// Filter out owner's own live selection (paymentMethod=null)
selections.forEach((selection) => {
  const isOwnerLiveSelection = selection.paymentMethod === null &&
    ownerSessionId &&
    selection.sessionId === ownerSessionId
  if (isOwnerLiveSelection) return // Skip
  // ... add to claimed quantities
})
```

**SplitForm.tsx:**
```typescript
// Filter out owner's own live selection from selections prop
const otherSelections = selections.filter(sel => {
  const isOwnLiveSelection = sel.paymentMethod === null &&
    'sessionId' in sel &&
    sel.sessionId === currentSessionId
  return !isOwnLiveSelection
})

// Filter out from liveSelections array
const otherLiveSelections = liveSelections.filter(sel =>
  sel.sessionId !== currentSessionId
)

// Combine for claimed calculation
const allSelections = [...otherSelections, ...validLiveSelections]
```

**Key Points:**
- Only filter out **live** selections (`paymentMethod=null`)
- Keep submitted selections (`paymentMethod` set) in calculations
- Use `sessionId` for identification (stored in localStorage)
- Filter in **both** `selections` prop and `liveSelections` state
- This allows owner to freely toggle between 0x, 1x, 2x, etc. ✅

### 12. Payment Status Terminology
**CRITICAL:** Status field is NO LONGER used for payment tracking. Use `paid` flag only.

**New Terminology (2024):**
- **status**: ALWAYS 'SELECTING' (never changes)
- **paid flag**: false=ausgewählt (guest is selecting), true=bestätigt (payer confirmed)
- **NO "Bereits bezahlt" badge** - Position-level payment display removed
- **NO payment buttons** - Guests see PayPal link (optional) and pay externally

**Two Selection States (all with status=SELECTING):**

1. **Ausgewählt** - Guest is actively choosing items
   - `paid=false`
   - Created/updated via `/api/live-selections/update`
   - Shown in real-time to payer (guest selection badges, live updates)
   - Shown in PaymentOverview as "Ausgewählt" (blue)
   - Guest can use optional PayPal link or pay cash directly

2. **Bestätigt** - Payer manually confirmed payment received
   - `paid=true`
   - Updated via `/api/selections/[id]/mark-paid`
   - Shown in PaymentOverview as "Bestätigt" (green)

**UI Labels:**
- GuestSelectionsList Badge (Live): "🔵 Auswählt gerade" (blue with pulse animation) - guest is actively selecting
- GuestSelectionsList Badge (Owner): "⏳ Eingereicht" (yellow) → "✓ Zahlung bestätigt" (green)
- GuestSelectionsList Badge (Guest): "⏳ Eingereicht" (always yellow, no confirmation visible to guests)
- Payment Method Badge: "💵 Bar" or "💳 PayPal" (shown when paymentMethod is set)
- Button text (Owner only): "✓ Zahlung bestätigen" (action to confirm) / "↻ Zahlung zurücksetzen" (action to reset)
- NO item-level "Bereits bezahlt" badges anymore
- NO payment buttons for guests - only PayPal link (optional) + cash payment info
- NO date/time display in guest list (removed for cleaner UI)

**Editable Name Components:**
- **Guests:** `EditableGuestName` in purple box above item selection
  - Shows "Du bist: [Name]" with edit icon
  - Saves to localStorage only
  - Updates live selection via API on change
- **Owner (Payer):** `EditablePayerName` in blue box above item selection
  - Shows "Für mich: [Name]" with edit icon
  - Saves to database via `/api/bills/[id]/update-payer`
  - Updates localStorage and live selection on change
  - Also updates `payerName` in Bill table
- Both positioned at top of SplitForm component
- Edit UI: inline input with checkmark/X buttons, Enter to save, Escape to cancel

**GuestSelectionsList Accordion UI:**
- Compact collapsed view showing: Name, status badges, payment method, total amount, chevron icon
- Clickable header expands/collapses details (smooth rotation animation on chevron)
- Expanded view shows: Individual items with quantities, tip amount (if any), payment buttons (owner only)
- Default state: All collapsed for better overview
- Hover effect on header for better UX

**Data Fetching:**
- StatusPageClient fetches ALL selections via `/api/bills/[id]/selections` (all have status=SELECTING)
- Client-side filtering by `paid` flag and `paymentMethod`:
  - `paymentMethod=null` → Live selection (guest still choosing)
  - `paymentMethod set, paid=false` → Submitted/Eingereicht (yellow)
  - `paymentMethod set, paid=true` → Confirmed/Zahlung bestätigt (green)
- **NOT** using separate APIs - single source of truth (StatusPageClient → GuestSelectionsList)

### 12. PayPal Payment (Optional)
**Purpose:** Provide guests with easy PayPal link to pay payer directly

**Implementation:**
- If `paypalHandle` configured → Show PayPal.me link in SplitForm
- Link format: `https://paypal.me/{paypalHandle}/{amount}`
- Guest clicks link → Opens PayPal in new tab → Pays externally
- **NO tracking of payment** - payer manually confirms after receiving money
- Alternative: Guest pays cash directly to payer

**Important:** PayPal.me links WITHOUT currency codes work best on mobile (known PayPal app bug with EUR suffix)

### 13. Error Handling
- Consistent format: `{ error: "German message" }`
- Log errors server-side for debugging
- User-friendly messages (no stack traces)

### 14. Session-based Tracking
- Each browser gets unique sessionId (UUID v4) stored in localStorage
- Generated via `getOrCreateSessionId()` from `lib/sessionStorage.ts`
- Used for:
  - Selection unique constraint (prevents duplicate selections per browser)
  - Restoring selection when guest returns
  - Identifying which guest made which selection
- Persists across page reloads but unique per browser
- Required field in Selection model (not optional)
- **One selection per session** - guests cannot make multiple payments (unique constraint)

### 15. Live Selections (Unified Real-time Tracking)
**Purpose:** Track guest selections in real-time from item selection through payment confirmation

**Architecture:** Uses unified Selection table - ALL selections have `status='SELECTING'`

**Two Selection States (identified by paid flag only):**

1. **Ausgewählt** (`paid=false`)
   - Guest is actively choosing items
   - Created/updated via `POST /api/live-selections/update`
   - Shown in real-time with selection badges on items
   - Shown in PaymentOverview as "Ausgewählt" (blue)
   - Guest can use optional PayPal link or pay cash directly

2. **Bestätigt** (`paid=true`)
   - Payer manually confirmed payment received
   - Updated via `POST /api/selections/[id]/mark-paid`
   - Shown in PaymentOverview as "Bestätigt" (green)

**Data flow:**
1. **Guest enters name and selects items:**
   - `POST /api/live-selections/update` on every quantity change
   - **CRITICAL:** Each update includes current `tipAmount` (calculated from current tip percentage)
   - This ensures default 10% tip is always reflected in DB, even if guest hasn't explicitly changed it
   - Creates/updates Selection (status=SELECTING, paid=false)
   - Real-time updates via Supabase WebSocket
   - Guest sees optional PayPal link (if configured) to pay externally

2. **Guest pays (externally - NOT tracked):**
   - Guest clicks PayPal link → Opens PayPal.me in new tab → Pays payer
   - OR guest pays cash directly to payer
   - **NO database update** - payment happens outside system

3. **Payer receives money and manually confirms:**
   - `POST /api/selections/[id]/mark-paid`
   - Updates Selection row (status=SELECTING, **paid=true**)
   - Only paid flag changes!

**PaymentOverview Display:**
- Fetches ALL selections via `/api/bills/[id]/selections`
- Client-side filtering by `paid` flag only:
  - `paid=false` → "Ausgewählt" (blue)
  - `paid=true` → "Bestätigt" (green)
- Updates in real-time via WebSocket when selections change

**Important:**
- Uses **Supabase Realtime ONLY** (WebSocket-based) - no polling!
- Automatic reconnection with exponential backoff if connection drops
- Entries are **persistent** (expire after 30 days) to allow multi-day bill splitting
- **Not deleted when guest leaves page** - allows guests to return and continue
- All selections share same table row (unique per billId + sessionId)
- **NO payment tracking** - guests pay externally (PayPal or cash)

**Persistence:**
- All selections (status=SELECTING) expire after 30 days
- Guests can close browser and return days later - their selection persists in DB
- All data stored in unified Selection table (single source of truth)
- Cleanup happens via DELETE (after 30 days), NOT status change

**Empty Selection Handling:**
- When guest deselects ALL items, the Selection is UPDATED with `itemQuantities = {}`, NOT deleted
- This preserves `tipAmount` and `friendName` so guest can continue selection process
- Empty selections are filtered out client-side (no badges shown, not counted in totals)
- Allows guests to:
  - Select tip percentage first, then choose items
  - Deselect all items to reconsider without losing tip
  - Return to selection later with tip still saved
- **Technical:** UPDATE events are used instead of DELETE events for better realtime support

**Benefits:**
- Instant updates (< 100ms vs 3s with polling)
- 99% less server requests (WebSocket vs HTTP polling)
- Scales to 100+ concurrent users without performance issues
- Payer sees real-time progress (who's selecting what)
- Prevents over-selection (guests see what others selected)
- Better UX for large groups
- Multi-day bill splitting supported
- Simplified architecture (one table instead of two)

### 16. Share Link Features
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
   - Displays on `/bills/[id]/status` page
   - Uses `react-qr-code` library (QRCodeSVG component)
   - Level "H" (high) error correction
   - Configurable size (default 200px)
   - Friends can scan QR code to open split page instantly

**Usage Pattern:**
- Status page shows: Copy button + WhatsApp button + QR code
- All three methods open same share link: `/split/[shareToken]`
- QR codes especially useful for in-person bill splitting (restaurant table)

### 17. Google Places Integration (Restaurant Reviews)
**Purpose:** Automatically find restaurant on Google Maps and generate review links for guests

**Architecture:**
1. **Claude Vision API** extracts restaurant name + address from receipt
2. **Google Places Text Search API** finds restaurant on Google Maps
3. **Review URL** generated: `https://search.google.com/local/writereview?placeid={placeId}`
4. **WhatsApp message** includes review request when restaurant found

**Data Flow:**
```
Upload receipt → Claude extracts name + address
              → Google Places searches restaurant
              → Bill updated with placeId, googleMapsUrl, reviewUrl
              → Status page shows review link + QR code
              → WhatsApp message includes review request
```

**Database Fields (Bill table):**
- `restaurantAddress` - Full address extracted from receipt
- `googlePlaceId` - Unique Google Place ID (e.g., "ChIJ...")
- `googleMapsUrl` - Direct link to restaurant on Google Maps
- `reviewUrl` - Link for guests to leave Google review

**Implementation:**
- **Upload Route:** Automatically calls `searchRestaurant()` after Claude analysis
- **Non-blocking:** App continues if Google Places API fails (no error shown to user)
- **Caching:** Place ID stored in database (no repeated API calls for same restaurant)

**Components:**
- `ReviewLinkSection` - Displays review URL with copy button (shown when `reviewUrl` exists)
- `WhatsAppShareButton` - Appends review request to message if `reviewUrl` + `restaurantName` provided

**API Setup:**
- Requires `GOOGLE_PLACES_API_KEY` in `.env`
- Enable "Places API (New)" in Google Cloud Console
- $200/month free credit (~6250 free searches)
- Text Search: ~$32 per 1000 requests

**Error Handling:**
- Missing API key → Logged, app continues without review link
- Restaurant not found → No error, app continues without review link
- API error → Logged, app continues without review link

**Google Places API Response:**
```typescript
{
  placeId: string           // "ChIJ..." format
  name: string              // Verified restaurant name
  formattedAddress: string  // Google's standardized address
  googleMapsUrl: string     // Link to Google Maps
  reviewUrl: string         // Review link for guests
  photoUrl?: string         // Optional restaurant photo
  rating?: number           // Optional Google rating
  userRatingsTotal?: number // Optional review count
}
```

**Best Practices:**
- Trust Google's address format over Claude's (more accurate)
- Review URL works even if guest doesn't have Google account (prompts sign-in)
- QR code can be used for in-person review requests
- WhatsApp message is opt-in (only sent if user clicks WhatsApp button)

### 18. BillItem Realtime Updates (Postgres Changes)
**Purpose:** Automatically notify all connected clients when bill items are created, updated, or deleted

**Architecture:** Uses Supabase Realtime `postgres_changes` - same reliable architecture as Selection table

**How it works:**
1. API route performs database operation (INSERT/UPDATE/DELETE on BillItem)
2. Supabase automatically fires `postgres_changes` event via WebSocket
3. All subscribed clients receive event (< 100ms latency)
4. Components refetch items from `/api/bills/[id]/items`
5. UI updates automatically

**Setup Required:**
1. **Enable Realtime for BillItem table:**
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE "BillItem";
   ```
   Run the provided [ENABLE-BILLITEM-REALTIME.sql](ENABLE-BILLITEM-REALTIME.sql) script in Supabase SQL Editor.

2. **Create RLS Policies:**
   - SELECT, INSERT, UPDATE, DELETE policies for `anon` and `authenticated` roles
   - Required for Realtime events to reach clients
   - Script includes all necessary policies

**Components with `onItemChange` handler:**
- `StatusPageClient` - Owner's status dashboard, refetches items when changes detected
- `SplitFormContainer` - Guest split form container, refetches items when changes detected

**Hook Integration:**
The `useRealtimeSubscription` hook automatically subscribes to BillItem changes:
```typescript
const { isConnected } = useRealtimeSubscription(billId, {
  onItemChange: () => {
    console.log('Item changed - refetching')
    fetchItems()
  }
})
```

**Benefits:**
- **100% reliable** - Postgres-level events, not manual broadcasts
- **Instant updates** - < 100ms latency across all users
- **Automatic** - No manual event firing needed in API routes
- **Consistent** - Same architecture as Selection table
- **Scalable** - Handles 100+ concurrent users
- **Simpler code** - No broadcast helper functions needed

**Important:**
- Realtime must be enabled for BillItem table in Supabase
- RLS policies required for events to reach clients
- Events filtered client-side by billId (same as Selection)
- Client-side filtering prevents cross-bill event leakage

### 19. Realtime Subscription Hook (useRealtimeSubscription)
**Purpose:** Centralized Supabase Realtime management with connection monitoring and automatic reconnection

**Location:** `lib/hooks/useRealtimeSubscription.ts`

**Features:**
- ✅ Unique channel per component via `channelSuffix` parameter (prevents channel conflicts)
- ✅ Singleton Supabase client with `persistSession: false` (prevents multiple GoTrueClient instances)
- ✅ React Strict Mode compatible (ignores CLOSED status during active subscription)
- ✅ Connection status tracking (CONNECTING, CONNECTED, DISCONNECTED, RECONNECTING)
- ✅ Automatic reconnection with exponential backoff (1s, 2s, 4s... max 30s)
- ✅ Initial data fetch on mount and after reconnection
- ✅ **NEW ARCHITECTURE:** Subscriptions for unified Selection table (all have status='SELECTING')
- ✅ Fires BOTH callbacks (`onSelectionChange` + `onActiveSelectionChange`) on ANY Selection change
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

  // CRITICAL: Unique channel suffix to avoid conflicts
  // When multiple components subscribe to same bill, each needs unique suffix
  channelSuffix: 'status',  // Creates channel "bill:${billId}:status"

  // Enable debug logging (development only)
  debug: process.env.NODE_ENV === 'development'
})
```

**Components using this hook:**
- `StatusPageClient.tsx` - Subscribes to Selection changes with channelSuffix='status'
- `SplitForm.tsx` - Subscribes to Selection changes and item-changed broadcasts with channelSuffix='form'
- `SplitFormContainer.tsx` - Subscribes to Selection changes and item-changed broadcasts with channelSuffix='container'

**CRITICAL - Channel Suffix Usage:**
When multiple components in the same page subscribe to the same bill, each MUST use a unique `channelSuffix`. Without unique suffixes, Supabase Realtime will only deliver events to ONE subscription (the last one created), causing realtime updates to fail for other components.

**Important (NEW ARCHITECTURE):**
- **ALL Selections have `status='SELECTING'`** - status never changes to 'PAID'
- **`paid` flag** differentiates: `false` = eingereicht (submitted), `true` = bestätigt (confirmed by payer)
- **Only ONE callback fires per event** - `onSelectionChange` takes precedence, `onActiveSelectionChange` is fallback
- **Debounced fetchSelections** (100ms) prevents race conditions from rapid updates
- Components filter client-side by `paid` flag and `paymentMethod` for display
- Live selections have `paymentMethod=null` (guest still choosing)

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
- Channel names use format: `bill:${billId}:${channelSuffix}` (e.g., "bill:uuid:status")
- **CRITICAL:** `channelSuffix` is REQUIRED when multiple components subscribe to same bill
- PostgreSQL filter removed - client-side filtering instead to avoid schema mismatch errors
- Event payload includes `eventType` (INSERT/UPDATE/DELETE) and `paid`/`paymentMethod` for debugging
- Fires BOTH `onSelectionChange` AND `onActiveSelectionChange` callbacks simultaneously (if both defined)
- Components using this hook typically use 100ms debounced fetchSelections to prevent race conditions
- Comprehensive debug logging available via `debug: true` option (use in development only)

### 19. Critical Supabase RLS Policies for Realtime
**IMPORTANT:** Realtime broadcasts require proper RLS policies on the `anon` role. Missing policies will silently block events!

**Required Policies for Selection Table:**

1. **SELECT Policy** (Read access - required for subscription)
```sql
CREATE POLICY "Allow public read access to Selection"
ON "Selection" FOR SELECT TO anon, authenticated USING (true);
```

2. **UPDATE Policy** (CRITICAL for deselection!)
```sql
CREATE POLICY "Allow public update to Selection"
ON "Selection" FOR UPDATE TO anon, authenticated
USING (true) WITH CHECK (true);
```
**Why:** When guests deselect items (including ALL items), the Selection is UPDATED with modified `itemQuantities` (can be empty `{}`), NOT deleted. This preserves `tipAmount` and `friendName` so guests can continue their selection process. Without UPDATE policy, UPDATE events are blocked and other clients don't see deselections in realtime.

3. **DELETE Policy** (Optional - not currently used)
```sql
CREATE POLICY "Allow public delete to Selection"
ON "Selection" FOR DELETE TO anon, authenticated USING (true);
```
**Why:** Currently NOT used - we UPDATE with empty `itemQuantities` instead of deleting to preserve tip. May be needed for future manual cleanup functionality.

4. **INSERT Policy** (For creating selections)
```sql
CREATE POLICY "Allow public insert to Selection"
ON "Selection" FOR INSERT TO anon, authenticated WITH CHECK (true);
```

**How to Apply:**
- Run `FIX-UPDATE-REALTIME.sql` in Supabase SQL Editor
- Or use `fix-rls-policies.sql` for all tables
- Verify with `DIAGNOSE-DELETE-REALTIME.sql`

**Common Bug:** If deselection only works after selecting a different item, the UPDATE policy is missing!

### 20. Selection Status Badge Logic
**CRITICAL UPDATE (2024):** "Bereits bezahlt" badge completely removed. No position-level payment display.

**Current Badge Types (SplitForm.tsx):**
1. **Green with pulse** - Own selection (current user selecting items)
2. **Blue with pulse** - Others' selections (other guests selecting items)
3. ~~**"Bereits bezahlt" badge**~~ - REMOVED (no longer displayed)

**Key Variables in SplitForm.tsx:**
- `isFullyMarked` - All portions allocated (all SELECTING) → Shows green checkmark ✓
- `isOverselected` - More than available quantity selected → Shows red warning
- ~~`isFullyPaid`~~ - REMOVED (no longer used)

**Guest List Badges (GuestSelectionsList.tsx):**
- 🔵 **"Auswählt gerade"** (blue with pulse) - Live selection, guest still choosing (paymentMethod=null)
- 🟡 **"Eingereicht"** - Guest submitted, awaiting payer confirmation (paymentMethod set, paid=false)
- 🟢 **"Zahlung bestätigt"** - Payer confirmed payment received (paid=true)
- 💵 **"Bar"** or 💳 **"PayPal"** - Payment method badge (only for submitted selections)
- Confirmation status only visible to payer - guests only see "Eingereicht"
- No date/time display (removed for cleaner UI)

**Accordion UI (GuestSelectionsList.tsx):**
- Entire header is clickable button with hover effect
- Chevron icon rotates 180° on expand (smooth transition)
- Collapsed view: Name, badges, total amount, chevron
- Expanded view: Individual items, tip (if any), payment buttons (owner only)
- Default state: All collapsed for better overview

**Why removed:** Simpler UX - payer manages payment confirmation via guest list accordion, not item list.

### 20. Debugging & Development Tools
**Purpose:** Comprehensive logging for debugging realtime issues and data flow

**Console Logging Strategy:**
- All logs use structured format with timestamps and component identifiers
- Logs are wrapped in START/END blocks for easy parsing
- Enabled by default in development, minimal in production

**Components with Comprehensive Logging:**

1. **useRealtimeSubscription.ts** - Realtime event tracking
   - Full payload logging (OLD/NEW records, eventType, billId)
   - Change detection (paid, paymentMethod, itemQuantities, friendName)
   - Callback execution tracking (start/completion/error)
   - Connection status changes
   - Enable via `debug: process.env.NODE_ENV === 'development'`

2. **StatusPageClient.tsx** - Status page data flow
   - Selection fetching (raw data, filtered data, counts)
   - State updates (when selections change)
   - Realtime connection status

3. **GuestSelectionsList.tsx** - Guest list rendering
   - Props received logging
   - useMemo recalculation tracking
   - Filtering logic (unpaid/paid splits)
   - Final sorted selections

4. **PaymentOverview.tsx** - Payment overview logic (if used)
   - Props received logging
   - Filtering submitted selections
   - useMemo recalculation

**Log Format Examples:**
```typescript
// Realtime event
⚡ [Realtime 2024-01-15T10:30:00.000Z] ===== SELECTION CHANGE EVENT =====
[Realtime] 📦 FULL PAYLOAD: { eventType: 'UPDATE', billId: '...', ... }
[Realtime] 📝 OLD RECORD: { id: '12345678', paid: false, ... }
[Realtime] 🆕 NEW RECORD: { id: '12345678', paid: true, ... }
[Realtime] ===== SELECTION CHANGE EVENT END (SUCCESS) =====

// Component data flow
🔍 [StatusPageClient 2024-01-15T10:30:00.000Z] ===== FETCHING SELECTIONS START =====
[StatusPageClient] 📥 RAW DATA from API: { count: 3, rawData: [...] }
[StatusPageClient] ✅ FILTERED SELECTIONS: { valid: 2, liveSelections: 1, ... }
[StatusPageClient] ===== FETCHING SELECTIONS END =====
```

**Debugging Workflow:**
1. Open browser console
2. Filter by component name (e.g., "[Realtime]" or "[StatusPageClient]")
3. Look for START/END blocks to understand data flow
4. Check for ⚠️ warnings or ❌ errors
5. Verify callback execution (🔥 Firing, ✅ completed)

**Common Issues Debuggable via Logs:**
- Channel conflicts (callbacks NOT defined despite subscription)
- Missing realtime events (check OLD/NEW records)
- State not updating (check setSelections calls)
- Race conditions (rapid consecutive updates)

### 21. Status Always SELECTING - Simplified Architecture (2024)
**BREAKING CHANGE:** The `status` field no longer changes to 'PAID'. All selections remain 'SELECTING'.

**Before (Old System):**
```
Guest selects items → status='SELECTING'
Guest submits payment → status='PAID'
Payer confirms → paid=true (status remains PAID)
```

**After (New System - Current):**
```
Guest selects items → status='SELECTING', paid=false
Guest pays externally (PayPal or cash) → NO DATABASE UPDATE
Payer confirms → status='SELECTING', paid=true (ONLY paid flag changes)
```

**Why This Change:**
1. **Simpler Logic** - Only one status value to handle
2. **Clearer Semantics** - `paid` flag indicates payer confirmation only
3. **Better UX** - Guests don't see payer-internal confirmation status
4. **No "Bereits bezahlt" Confusion** - Position-level payment badges removed
5. **Single Source of Truth** - All selections in one unified table
6. **No Payment Tracking** - Guest payment is external, we only track payer confirmation
7. **No Payment Buttons** - Guests use PayPal link (optional) or pay cash directly

**Two Selection States (All with status=SELECTING):**

1. **Ausgewählt** - Guest is actively choosing items
   - `status='SELECTING', paid=false`
   - Created/updated via `/api/live-selections/update`
   - Visible in real-time to payer (selection badges on items)
   - Shown in PaymentOverview as "Ausgewählt" (blue)

2. **Bestätigt** - Payer manually confirmed payment received
   - `status='SELECTING', paid=true`
   - Updated via `/api/selections/[id]/mark-paid`
   - Shows as "Bestätigt" (green) in PaymentOverview

**PaymentOverview Logic:**
- Fetches ALL selections: `GET /api/bills/[id]/selections` (all have status=SELECTING)
- Client-side filtering by `paid` flag only:
  ```typescript
  const ausgewählt = allSelections.filter(s => s.paid === false)  // Blue
  const bestätigt = allSelections.filter(s => s.paid === true)     // Green
  ```
- Real-time updates via WebSocket when selections change

**Live-Selections API:**
- `/api/bills/[id]/live-selections` - Returns ALL SELECTING selections
- Filters: `status='SELECTING'` and not expired
- Used by SplitForm for real-time selection tracking
- PaymentOverview uses main selections API with client-side filtering instead

**Migration Impact:**
- **Database:** No migration needed (status field still exists for backward compatibility)
- **API:** `/api/selections/create` route REMOVED (no longer needed)
- **API:** `/api/selections/[id]/mark-paid` only changes `paid` flag (not status)
- **Components:** All check `paid` flag instead of status for payment confirmation
- **Legacy Data:** Old PAID selections still work (treated as SELECTING with paid=true)

**Key Files Changed:**
- `app/api/selections/create/route.ts` - REMOVED (no payment buttons)
- `app/api/selections/[id]/mark-paid/route.ts` - Updated (only changes paid flag)
- `app/api/bills/[id]/selections/route.ts` - Returns all SELECTING (no filtering)
- `components/PaymentOverview.tsx` - Client-side filtering by paid flag only
- `components/GuestSelectionsList.tsx` - Updated (uses paid flag for badges)
- `components/SplitForm.tsx` - Updated (removed payment buttons, added PayPal link)

**Documentation:**
- See `STATUS-ALWAYS-SELECTING.md` for complete technical details
- See `PAID-VS-STATUS-LOGIC.md` for comparison with old system

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

# Google Places API
GOOGLE_PLACES_API_KEY=AIzaSy...

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
1. Update `Selection` model in `prisma/schema.prisma` if schema changes needed (unified table)
2. Run `npx prisma db push` to sync database
3. Update `/api/live-selections/update` route if API changes needed
4. Update `SplitForm.tsx` quantity handlers to call live-selections API
5. Update `useRealtimeSubscription` hook if new event types needed
6. Update components using the hook (PaymentOverview, SplitForm, SplitFormContainer)
7. **Ensure RLS policies exist** (SELECT, INSERT, UPDATE, DELETE) for Realtime to work
8. Test with multiple browser windows to verify real-time sync

**Important:**
- All selections (status=SELECTING) expire after 30 days (set in `expiresAt` field)
- Cleanup happens via DELETE (after expiration), NOT status change
- Unique constraint: `(billId, sessionId) WHERE status='SELECTING'` prevents duplicate selections per browser
- Uses **Realtime ONLY** (no polling) - WebSocket must be enabled in Supabase
- All realtime logic is centralized in `useRealtimeSubscription` hook
- Automatic reconnection with exponential backoff if connection drops
- **Critical:** UPDATE and DELETE RLS policies required for deselection events!

**Adding new realtime event types:**
1. Add new callback to `RealtimeEventHandlers` interface in hook
2. Add corresponding `.on()` subscription in hook's `subscribe()` function
3. Use the new callback in components via hook options
4. All callbacks fetch selections with status=SELECTING (filter by `paid` flag for display)

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

### Supabase RLS Policies Setup
**When to run:** After creating new tables via Prisma schema changes (`npx prisma db push`)

**Problem:** New tables in Supabase don't have Row Level Security (RLS) policies by default, which blocks API access even with valid credentials.

**Solution:** Enable RLS and create public CRUD policies for each new table.

**Status:** ✅ All tables (Bill, BillItem, Selection, RestaurantFeedback) have RLS policies already configured.

**Example: RestaurantFeedback Table**
```sql
-- 1. Enable RLS for the table
ALTER TABLE "RestaurantFeedback" ENABLE ROW LEVEL SECURITY;

-- 2. Allow public read access
CREATE POLICY "Allow public read access to RestaurantFeedback"
ON "RestaurantFeedback" FOR SELECT TO anon, authenticated USING (true);

-- 3. Allow public insert
CREATE POLICY "Allow public insert to RestaurantFeedback"
ON "RestaurantFeedback" FOR INSERT TO anon, authenticated WITH CHECK (true);

-- 4. Allow public update
CREATE POLICY "Allow public update to RestaurantFeedback"
ON "RestaurantFeedback" FOR UPDATE TO anon, authenticated
USING (true) WITH CHECK (true);

-- 5. Allow public delete
CREATE POLICY "Allow public delete to RestaurantFeedback"
ON "RestaurantFeedback" FOR DELETE TO anon, authenticated USING (true);
```

**How to apply:**
1. Open Supabase Dashboard → SQL Editor
2. Paste the SQL commands above (replace "RestaurantFeedback" with your table name)
3. Execute the script
4. Verify policies exist: Database → Tables → [TableName] → Policies

**Why all policies are public:**
- App uses share tokens (UUID v4) for access control, not database-level auth
- Simpler than complex RLS rules per record
- Appropriate for bill-splitting use case where anyone with share link can access

**Important:**
- All four policies (SELECT, INSERT, UPDATE, DELETE) are required for full functionality
- Missing UPDATE or DELETE policies will break realtime updates
- Apply same pattern to all new tables that need API access

### Claude API Errors
- Verify `ANTHROPIC_API_KEY` in `.env.local`
- Ensure image URL is publicly accessible
- Check API quota at console.anthropic.com

### Build Errors
```bash
rm -rf .next && npm run build  # Clear cache and rebuild
```

### Vercel Build Cache Issues
**Symptoms:** Build fails with "Module not found" errors for existing files, or npm installs only 94 packages instead of 463

**Problem:** Vercel's build cache is corrupted and contains old dependency data

**Solution:**
1. **Vercel Dashboard** → Project → **Settings** → **General** → Scroll to **Advanced**
2. Click **"Clear Build Cache"** button
3. Go to **Deployments** tab → Latest deployment → **"..."** → **"Redeploy"**
4. IMPORTANT: Uncheck "Use existing Build Cache" when redeploying

**Prevention:** The `vercel.json` installCommand (`rm -rf node_modules .next && npm ci`) helps prevent this, but cannot clear Vercel's pre-restore cache layer. Manual cache clearing is required when cache becomes corrupted.

**Alternative:** Delete the Vercel project and re-import from GitHub for a completely fresh start.

### Real-time/Live Selection Issues
**Symptoms:** Live selections not updating, stale data, or missing updates

**✅ REALTIME FULLY WORKING:**
- ✅ **Selection table:** Realtime enabled with full CRUD policies (SELECT, INSERT, UPDATE, DELETE)
- ✅ **BillItem table:** Realtime enabled with full CRUD policies (SELECT, INSERT, UPDATE, DELETE)
- ✅ Both tables are in `supabase_realtime` publication
- ✅ RLS policies active for `anon` and `authenticated` roles
- ✅ WebSocket connections working for all selections (whole numbers AND fractional)
- ✅ Anteilige Markierungen (fractional selections like 1/2, 1/3) working in realtime

**Previous issue (FIXED):**
- ❌ **Problem:** Fraction buttons (1/2, 1/3) and "Teilen durch N" only updated local state, no API call
- ✅ **Solution:** Added `await handleItemQuantityChange()` to trigger realtime updates
- ✅ **Files changed:** [SplitForm.tsx:1300-1343](components/SplitForm.tsx#L1300-L1343)

**Common causes and fixes:**
1. **Supabase Realtime verification (already enabled, but verify if issues persist)**
   - Check Supabase dashboard → Database → Replication
   - Verify `Selection` and `BillItem` tables are in publication
   - Run SQL to verify: `SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';`
   - Should show both `Selection` and `BillItem` tables

1a. **Missing RLS Policies (MOST COMMON!)**
   - Symptom: Deselection only works after selecting a different item
   - Cause: UPDATE policy missing → UPDATE events are blocked
   - Solution: Run `FIX-UPDATE-REALTIME.sql` in Supabase SQL Editor
   - Required policies: SELECT, INSERT, **UPDATE**, DELETE (all on `anon` role)
   - Verify: Check `pg_policies` table for all four policy types

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

4. **Live selections not expiring**
   - Live selections (status=SELECTING) have 30-day expiration
   - Cleanup happens when guest submits payment (status → PAID)
   - Manual cleanup: Run SQL `DELETE FROM "Selection" WHERE status='SELECTING' AND "expiresAt" < NOW()`
   - Check `expiresAt` timestamps are being set correctly

5. **Duplicate SELECTING entries per browser**
   - Verify sessionId is consistent across component re-renders
   - Check localStorage for `userSessionId` key
   - Clear localStorage and refresh to generate new sessionId
   - Verify partial unique index exists: `(billId, sessionId) WHERE status='SELECTING'`

6. **React Strict Mode causing connection loops**
   - Symptom: Channels repeatedly CLOSED → RECONNECTING → CONNECTED
   - Cause: React Strict Mode double-mounts components in development
   - Solution: Hook already handles this with `isSubscribingRef` flag
   - Hook ignores CLOSED status during active subscription setup
   - Singleton Supabase client prevents multiple GoTrueClient warnings

**Debug tips:**
- Enable debug mode: `debug: true` in hook options
- Check browser console for `[Realtime]` messages with eventType (INSERT/UPDATE/DELETE)
- Monitor connection status: `connectionStatus` from hook
- Open PaymentOverview in one window, SplitForm in another (same bill)
- Watch Network tab for WebSocket connection (wss://)
- Check Supabase Table Editor for Selection entries (filter by status=SELECTING)
- Test reconnection: Turn WiFi off/on and watch reconnection attempts

### Vercel-Specific Issues

**Problem:** `/api/bills/[id]/selections` endpoint returns `[]` on Vercel but works locally

**Cause:** Unknown - possibly related to Next.js dynamic routing or Vercel's serverless architecture

**Solution:** Use `/api/bills/[id]/live-selections` instead
- All components now use `/live-selections` endpoint
- This endpoint works reliably on both local and Vercel environments
- Returns same data: `Selection` table with `status='SELECTING'` and not expired

**Components affected:**
- `StatusPageClient` → Uses `/live-selections` ✅
- `SplitFormContainer` → Uses `/live-selections` ✅
- `SplitForm` → Uses `/live-selections` ✅

**If you encounter similar issues:**
1. Check if endpoint works locally vs. Vercel
2. Compare with `/live-selections` implementation
3. Ensure all `.eq()` filters match database column names exactly
4. Check Vercel function logs for errors

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
│   └── status/page.tsx               # Payer dashboard with live updates and share link
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
└── ThemeProvider.tsx                  # Enforces dark mode globally

lib/
├── hooks/
│   ├── useRealtimeSubscription.ts    # Centralized Supabase Realtime hook
│   └── index.ts                       # Hooks barrel export
├── prisma.ts                          # Database client (singleton)
├── supabase.ts                        # Storage client (admin + anon)
├── claude.ts                          # Vision API integration
├── utils.ts                           # Helpers (formatEUR, sanitize, etc.)
├── billStorage.ts                     # Bill history localStorage utils
└── sessionStorage.ts                  # Session ID management (browser tracking)

prisma/
└── schema.prisma                      # Database schema (Bill, BillItem, Selection, ActiveSelection)
```

## Supabase Configuration

### Realtime Publication Status

**✅ ENABLED TABLES:**
- ✅ **BillItem** - Realtime enabled (for live item updates)
- ✅ **Selection** - Realtime enabled (for live guest selections)

**❌ DISABLED TABLES:**
- ❌ **Bill** - Realtime disabled (not needed, bill data rarely changes)
- ❌ **_BillItemToSelection** - Realtime disabled (legacy join table, not used)

**Verification:**
```sql
-- Check which tables have realtime enabled
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';

-- Expected result: BillItem, Selection
```

### Row Level Security (RLS) Policies

**All tables have RLS enabled with full CRUD policies for `anon` and `authenticated` roles.**

#### Bill Table Policies
- ✅ `Allow public delete to Bill` (DELETE) - anon, authenticated
- ✅ `Allow public insert to Bill` (INSERT) - anon, authenticated
- ✅ `Allow public read Bill` (SELECT) - anon, authenticated
- ✅ `Allow public update to Bill` (UPDATE) - anon, authenticated

#### BillItem Table Policies
- ✅ `Allow public delete to BillItem` (DELETE) - anon, authenticated
- ✅ `Allow public insert to BillItem` (INSERT) - anon, authenticated
- ✅ `Allow public read access to BillItem` (SELECT) - anon, authenticated
- ✅ `Allow public update to BillItem` (UPDATE) - anon, authenticated

#### Selection Table Policies
- ✅ `Allow public delete to Selection` (DELETE) - anon, authenticated
- ✅ `Allow public insert to Selection` (INSERT) - anon, authenticated
- ✅ `Allow public read access to Selection` (SELECT) - anon, authenticated
- ✅ `Allow public update to Selection` (UPDATE) - anon, authenticated

**Why all policies are public:**
- Bills are accessed via unguessable UUID share tokens (not sequential IDs)
- Share tokens act as "secret URLs" for bill access control
- Simpler architecture than complex RLS rules per bill
- Appropriate for public bill-splitting app

**Verification:**
```sql
-- Check RLS policies for a table
SELECT policyname, cmd AS command, roles
FROM pg_policies
WHERE tablename = 'Selection'
ORDER BY cmd;

-- Expected result: 4 policies (SELECT, INSERT, UPDATE, DELETE) for anon/authenticated
```

### Critical Configuration Notes

1. **UPDATE Policy is REQUIRED for Realtime**
   - Without UPDATE policy, Supabase blocks UPDATE events from being sent to clients
   - This was the root cause of anteilige Markierungen (fractional selections) not updating in realtime
   - All CRUD policies (SELECT, INSERT, UPDATE, DELETE) must exist for full realtime functionality

2. **Realtime Publication must be enabled**
   - Run: `ALTER PUBLICATION supabase_realtime ADD TABLE "TableName";`
   - Both BillItem and Selection tables are enabled
   - Bill table is intentionally disabled (not needed for realtime updates)

3. **Client-side filtering used instead of server-side**
   - Realtime subscriptions filter by billId on client-side
   - This avoids schema mismatch errors with Supabase filter syntax
   - Each component uses unique channelSuffix to prevent event conflicts

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
