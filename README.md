# 🍽️ RestoBill - Restaurant-Rechnungen einfach teilen

Eine Web-App zum einfachen Teilen von Restaurant-Rechnungen mit automatischer KI-Analyse und PayPal-Integration.

## Features

✨ **KI-powered OCR**: Claude Vision API analysiert Rechnungsfotos automatisch
💳 **PayPal.me Integration**: Direkte Weiterleitung mit vorausgefülltem Betrag
🔗 **Public Share Links**: Keine App-Installation für Freunde nötig
📊 **Flexible Aufteilung**: Halbe, ganze oder doppelte Portionen wählbar
💰 **Trinkgeld-Rechner**: 0%, 10%, 15%, 20% oder eigener Betrag
📱 **Responsive Design**: Funktioniert auf Desktop und Mobile
🌐 **Serverless**: Komplett auf Vercel + Supabase gehostet

## Tech Stack

- **Frontend/Backend**: Next.js 14 (App Router) + TypeScript
- **Database**: Supabase PostgreSQL + Prisma ORM
- **Storage**: Supabase Storage (S3-kompatibel)
- **AI/OCR**: Anthropic Claude Vision API
- **Styling**: Tailwind CSS
- **Hosting**: Vercel (Serverless)

## User Flow

### Für den Zahler:

1. Name + PayPal Username eingeben (`paypal.me/username`)
2. Foto der Rechnung hochladen
3. KI analysiert automatisch alle Positionen
4. Positionen überprüfen (editierbar)
5. Share-Link an Freunde verteilen
6. Status-Dashboard zeigt wer bezahlt hat

### Für Freunde:

1. Link öffnen (kein Download nötig!)
2. Namen eingeben
3. Positionen auswählen (0.5x, 1x, 2x)
4. Optional Trinkgeld hinzufügen
5. Auf "Bezahlen" klicken → PayPal mit vorausgefülltem Betrag

## Setup

### 1. Repository clonen

```bash
git clone https://github.com/yourusername/RestoBill.git
cd RestoBill
npm install
```

### 2. Supabase Setup (5 Minuten)

1. Gehe zu [supabase.com](https://supabase.com)
2. Erstelle ein neues Projekt "RestoBill"
3. Kopiere die Credentials:
   - **Database URL**: Project Settings → Database → Connection String
   - **API Keys**: Project Settings → API → anon key + service_role key

4. Erstelle Storage Bucket:
   ```sql
   -- In Supabase SQL Editor ausführen:
   INSERT INTO storage.buckets (id, name, public)
   VALUES ('bill-images', 'bill-images', true);
   ```

5. Storage Policy setzen (Public Read):
   ```sql
   -- Public read access
   CREATE POLICY "Public read access"
   ON storage.objects FOR SELECT
   USING (bucket_id = 'bill-images');

   -- Authenticated upload
   CREATE POLICY "Authenticated upload"
   ON storage.objects FOR INSERT
   WITH CHECK (bucket_id = 'bill-images');
   ```

### 3. Claude API Key

1. Gehe zu [console.anthropic.com](https://console.anthropic.com)
2. Erstelle einen API Key
3. Kopiere den Key

### 4. Environment Variables

Erstelle `.env.local` im Root-Verzeichnis:

```env
# Claude API
ANTHROPIC_API_KEY=sk-ant-api03-...

# Supabase Database
DATABASE_URL="postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"

# Supabase Storage & API
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 5. Datenbank Migrieren

```bash
npx prisma generate
npx prisma db push
```

### 6. Development Server starten

```bash
npm run dev
```

App läuft auf [http://localhost:3000](http://localhost:3000)

## Deployment auf Vercel

### 1. GitHub Repository

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Vercel Setup

1. Gehe zu [vercel.com](https://vercel.com)
2. Import Git Repository
3. Framework Preset: **Next.js**
4. Füge alle Environment Variables hinzu (aus `.env.local`)
5. Update `NEXT_PUBLIC_APP_URL` zu deiner Vercel URL:
   ```
   NEXT_PUBLIC_APP_URL=https://restobill.vercel.app
   ```
6. Deploy!

### 3. Datenbank Migration auf Production

Nach erstem Deploy:

```bash
# Mit Production DB verbinden
DATABASE_URL="postgresql://..." npx prisma db push
```

## Datenbankschema

```prisma
model Bill {
  id             String       @id @default(uuid())
  createdAt      DateTime     @default(now())
  payerName      String
  paypalHandle   String
  imageUrl       String
  restaurantName String?
  totalAmount    Float?
  shareToken     String       @unique
  items          BillItem[]
  selections     Selection[]
}

model BillItem {
  id           String       @id @default(uuid())
  billId       String
  name         String
  quantity     Int
  pricePerUnit Float
  totalPrice   Float
  bill         Bill         @relation(...)
  selections   Selection[]
}

model Selection {
  id             String      @id @default(uuid())
  billId         String
  friendName     String
  items          BillItem[]
  itemQuantities Json?
  tipAmount      Float       @default(0)
  paid           Boolean     @default(false)
  paidAt         DateTime?
  createdAt      DateTime    @default(now())
  bill           Bill        @relation(...)
}
```

## Kosten

### Free Tier Limits

| Service | Free Tier | Kosten danach |
|---------|-----------|---------------|
| **Vercel** | Unlimited Deploys<br>100GB Bandwidth/mo | $20/mo pro Team Member |
| **Supabase** | 500MB Database<br>1GB Storage<br>2GB Bandwidth | Ab $25/mo (Pro Plan) |
| **Claude API** | Pay-per-use<br>$3/1M input tokens<br>$15/1M output tokens | Keine Flat Fee |

### Geschätzte Kosten (MVP)

**100 Rechnungen/Monat mit je 10 Positionen:**
- Vercel: $0 (Free Tier)
- Supabase: $0 (Free Tier)
- Claude API: ~$2-5 (100 Analysen × ~500 Tokens)

**Total: $0-5/Monat**

## Projektstruktur

```
RestoBill/
├── app/
│   ├── page.tsx                    # Landing Page
│   ├── create/
│   │   └── page.tsx                # Bill Creation
│   ├── bills/[id]/
│   │   ├── upload/page.tsx         # Image Upload
│   │   ├── review/page.tsx         # Review Items
│   │   └── status/page.tsx         # Status Dashboard
│   ├── split/[token]/
│   │   └── page.tsx                # Public Split Page
│   └── api/
│       ├── bills/create/route.ts
│       ├── bills/[id]/upload/route.ts
│       └── selections/create/route.ts
├── components/
│   ├── ShareLink.tsx               # Copy + WhatsApp Share
│   └── SplitForm.tsx               # Item Selection + Tip
├── lib/
│   ├── prisma.ts                   # Database Client
│   ├── supabase.ts                 # Storage Client
│   ├── claude.ts                   # AI Vision API
│   └── utils.ts                    # Helpers
├── prisma/
│   └── schema.prisma               # DB Schema
└── .env.local                      # Environment Variables
```

## API Routes

### POST /api/bills/create
Erstellt eine neue Rechnung.

**Request:**
```json
{
  "payerName": "Max Mustermann",
  "paypalHandle": "maxmustermann"
}
```

**Response:**
```json
{
  "billId": "uuid",
  "shareToken": "uuid"
}
```

### POST /api/bills/[id]/upload
Lädt Rechnung hoch und analysiert sie.

**Request:** FormData mit `image` field

**Response:**
```json
{
  "success": true,
  "itemsCount": 12,
  "imageUrl": "https://..."
}
```

### POST /api/selections/create
Erstellt eine Auswahl und generiert PayPal URL.

**Request:**
```json
{
  "billId": "uuid",
  "shareToken": "uuid",
  "friendName": "Anna",
  "itemQuantities": {
    "item-uuid-1": 1,
    "item-uuid-2": 0.5
  },
  "tipAmount": 2.50
}
```

**Response:**
```json
{
  "selectionId": "uuid",
  "totalAmount": 27.50,
  "paypalUrl": "https://paypal.me/maxmustermann/27.50?locale.x=de_DE"
}
```

## Sicherheit

✅ UUID v4 Share Tokens (unguessable)
✅ Keine sensiblen Daten in URLs
✅ Prisma ORM (SQL Injection Protection)
✅ File Upload Validation (Type + Size)
✅ Next.js Default XSS Protection
✅ Server-side API Key Storage

## Zukünftige Features (Phase 2+)

- [ ] Items manuell editieren/löschen
- [ ] QR-Code für Share Links
- [ ] Automatisches Paid-Tracking via PayPal Webhooks
- [ ] Multi-Currency Support
- [ ] Item-Splitting (mehrere Leute teilen 1 Pizza)
- [ ] Historische Rechnungen
- [ ] User Accounts (optional)
- [ ] PWA Support
- [ ] Email-Benachrichtigungen

## Troubleshooting

### Prisma Client Error
```bash
# Regenerate Prisma Client
npx prisma generate
```

### Supabase Storage Error
- Stelle sicher dass der Bucket `bill-images` existiert
- Prüfe Storage Policies (Public Read Access)

### Claude API Error
- Prüfe API Key in `.env.local`
- Stelle sicher dass Bild-URL public erreichbar ist
- Check API Limits: [console.anthropic.com](https://console.anthropic.com)

### Next.js Build Error
```bash
# Clear cache
rm -rf .next
npm run build
```

## Lizenz

MIT

## Support

Bei Fragen oder Problemen erstelle ein Issue auf GitHub.

---

Made with ❤️ and Claude
