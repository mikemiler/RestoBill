# RestoBill - Bill Splitting App mit PayPal Integration

## Problem
Eine Person zahlt die Restaurant-Rechnung und muss dann von allen Teilnehmern das Geld einsammeln.

## Lösung - KISS Prinzip

### Core Features
1. **Zahler** hinterlegt PayPal-Adresse
2. **Upload** Foto der Restaurant-Rechnung
3. **AI-Analyse** (Claude) extrahiert Positionen automatisch
4. **Public Link** zum Teilen mit Freunden
5. **Freunde** wählen ihre Positionen (ohne App-Installation)
6. **Trinkgeld** optional hinzufügen
7. **PayPal-Zahlung** direkt mit vorausgefülltem Betrag

---

## Tech Stack (KISS)

### Frontend & Backend
- **Next.js 14** (App Router)
  - Reason: React + API Routes in einem, SSR für Public Links, kein separates Backend nötig

### Database
- **SQLite** mit Prisma ORM
  - Reason: Keine separate DB-Installation nötig, perfekt für Start, später leicht auf PostgreSQL migrierbar

### AI/OCR
- **Claude API** (Anthropic)
  - Reason: Vision API kann Bilder analysieren und strukturierte Daten extrahieren

### File Storage
- **Lokales Filesystem** (`/public/uploads`)
  - Reason: Kein S3/Cloud Setup nötig, später leicht migrierbar

### PayPal Integration
- **PayPal.me Links** (Phase 1)
  - Reason: Keine komplexe API-Integration, einfache URL-Generierung
  - Format: `https://paypal.me/username/betrag`

### Styling
- **Tailwind CSS**
  - Reason: Schnelles Styling ohne Custom CSS

---

## Datenmodell

```prisma
model Bill {
  id            String    @id @default(uuid())
  createdAt     DateTime  @default(now())

  // Zahler Info
  payerName     String
  paypalHandle  String    // z.B. "maxmustermann" für paypal.me/maxmustermann

  // Rechnung
  imageUrl      String
  restaurantName String?
  totalAmount   Float?

  // Items aus OCR
  items         BillItem[]

  // Selections von Freunden
  selections    Selection[]

  // Public Link Token
  shareToken    String    @unique
}

model BillItem {
  id          String    @id @default(uuid())
  billId      String
  bill        Bill      @relation(fields: [billId], references: [id])

  name        String    // z.B. "Pizza Margherita"
  quantity    Int       // z.B. 2
  pricePerUnit Float    // z.B. 12.50
  totalPrice  Float     // quantity * pricePerUnit

  selections  Selection[]
}

model Selection {
  id          String    @id @default(uuid())
  billId      String
  bill        Bill      @relation(fields: [billId], references: [id])

  friendName  String    // Eingegebener Name

  // Ausgewählte Items
  items       BillItem[]

  // Trinkgeld
  tipAmount   Float     @default(0)

  // Status
  paid        Boolean   @default(false)
  paidAt      DateTime?

  createdAt   DateTime  @default(now())
}
```

---

## User Flow

### 1. Zahler erstellt Rechnung
```
POST /api/bills/create
- Input: payerName, paypalHandle
- Output: billId

POST /api/bills/{billId}/upload
- Input: image file
- Process:
  1. Save image to /public/uploads/{billId}.jpg
  2. Call Claude Vision API mit Prompt:
     "Analysiere diese Restaurant-Rechnung und extrahiere alle Positionen
      im JSON-Format: {items: [{name, quantity, pricePerUnit}]}"
  3. Parse Response und speichere BillItems
- Output: {items[], shareToken}

Redirect zu: /bills/{billId}/review
```

### 2. Zahler reviewed und teilt Link
```
GET /bills/{billId}/review
- Zeigt: Alle erkannten Items (editierbar!)
- Action: "Link teilen"
- Share Link: /split/{shareToken}
```

### 3. Freund wählt Positionen aus
```
GET /split/{shareToken}
- Public Page (kein Login)
- Zeigt: Restaurant-Rechnung Bild + Liste aller Items
- Form:
  1. Name eingeben
  2. Checkboxen für Items (mit Quantity Selector wenn Item quantity > 1)
  3. Trinkgeld % Slider (0%, 10%, 15%, 20%, Custom)
  4. "Weiter zur Zahlung"

POST /api/selections/create
- Input: {shareToken, friendName, selectedItems[], tipAmount}
- Calculate: totalAmount = sum(selectedItems) + tipAmount
- Output: {selectionId, paypalUrl}
- paypalUrl = `https://paypal.me/${bill.paypalHandle}/${totalAmount}?locale.x=de_DE`

Redirect zu PayPal oder zeige QR-Code
```

### 4. Zahler sieht Übersicht
```
GET /bills/{billId}/status
- Zeigt:
  - Wer hat was ausgewählt
  - Wer hat gezahlt (manuell markierbar)
  - Offene Beträge
  - Gesamtübersicht
```

---

## Implementierungs-Phasen

### Phase 1: MVP (Minimal Viable Product)
**Ziel: Grundfunktionalität lauffähig**

1. **Setup Project** (1 Task)
   - Next.js 14 + TypeScript + Tailwind CSS
   - Prisma + SQLite
   - Folder Structure

2. **Bill Creation Flow** (3 Tasks)
   - Page: `/create` - Form für Zahler (Name + PayPal Handle)
   - API: `POST /api/bills/create`
   - Page: `/bills/[id]/upload` - Image Upload

3. **OCR/AI Integration** (2 Tasks)
   - API: `POST /api/bills/[id]/upload` mit Claude Vision API
   - Claude Prompt Engineering für optimale Extraktion

4. **Review & Share** (2 Tasks)
   - Page: `/bills/[id]/review` - Items editierbar
   - Generate Share Link

5. **Public Split Page** (3 Tasks)
   - Page: `/split/[token]` - Public View
   - Item Selection UI mit Checkboxen
   - Tip Calculator

6. **Payment Flow** (2 Tasks)
   - API: `POST /api/selections/create`
   - PayPal.me URL Generation
   - Redirect to PayPal

7. **Status Dashboard** (1 Task)
   - Page: `/bills/[id]/status` - Übersicht für Zahler

**Total: ~14 Tasks**

### Phase 2: Verbesserungen
- Items editieren/korrigieren falls OCR Fehler
- QR-Code für PayPal Link
- WhatsApp Share Button
- Automatisches "Paid" Tracking (via PayPal Webhooks - komplex!)
- Responsive Design Optimierung

### Phase 3: Nice-to-Have
- Multi-Currency Support
- Verschiedene Payment Provider (Venmo, Wise, etc.)
- Item-Splitting (halbe Pizza)
- Historische Rechnungen
- User Accounts (optional)

---

## Dateistruktur

```
RestoBill/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # Landing Page
│   ├── create/
│   │   └── page.tsx                # Bill Creation Form
│   ├── bills/
│   │   └── [id]/
│   │       ├── upload/
│   │       │   └── page.tsx        # Image Upload
│   │       ├── review/
│   │       │   └── page.tsx        # Review Items
│   │       └── status/
│   │           └── page.tsx        # Status Dashboard
│   ├── split/
│   │   └── [token]/
│   │       └── page.tsx            # Public Split Page
│   └── api/
│       ├── bills/
│       │   ├── create/
│       │   │   └── route.ts
│       │   └── [id]/
│       │       └── upload/
│       │           └── route.ts
│       └── selections/
│           └── create/
│               └── route.ts
├── components/
│   ├── BillItemList.tsx
│   ├── ItemSelector.tsx
│   ├── TipCalculator.tsx
│   └── PaymentButton.tsx
├── lib/
│   ├── prisma.ts                   # Prisma Client
│   ├── claude.ts                   # Claude API Integration
│   └── utils.ts
├── prisma/
│   └── schema.prisma
├── public/
│   └── uploads/                    # Bill Images
├── .env.local
├── package.json
└── tsconfig.json
```

---

## Environment Variables

```env
# Claude API
ANTHROPIC_API_KEY=sk-ant-...

# Database
DATABASE_URL="file:./dev.db"

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Vereinfachungen (KISS)

### Was wir NICHT machen (vorerst):
❌ User Authentication - Nur Session-based für Zahler
❌ PayPal OAuth/API - Nur PayPal.me Links
❌ Automatisches Payment Tracking - Manuell markieren
❌ Mobile App - Nur Web (PWA-ready)
❌ Cloud Storage - Lokales Filesystem
❌ Complex Error Handling - Basic try/catch
❌ Tests - Nur manuelles Testing für MVP
❌ Item Splitting - 1 Person pro Item (oder Quantity)

### Was wir machen:
✅ Simple Next.js App
✅ SQLite Database
✅ Claude Vision für OCR
✅ PayPal.me Links
✅ Public shareable Links
✅ Responsive Web UI

---

## Nächste Schritte

1. **Initialize Next.js Project**
2. **Setup Prisma + SQLite**
3. **Implement Bill Creation**
4. **Integrate Claude Vision API**
5. **Build Public Split Page**
6. **Test End-to-End Flow**

---

## Security Considerations

- ShareToken: UUID v4 (unguessable)
- No sensitive data in URLs
- Rate limiting für API calls
- Image upload validation (size, type)
- XSS protection (Next.js default)
- SQL Injection protection (Prisma ORM)

---

## Abschätzung Entwicklungszeit

**MVP (Phase 1):** ~1-2 Tage Development
- Setup: 1h
- Backend Logic: 4h
- Frontend Pages: 6h
- Claude Integration: 2h
- Testing & Bug Fixes: 3h

**Total: ~16h für voll funktionsfähiges MVP**
