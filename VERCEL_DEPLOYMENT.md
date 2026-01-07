# 🚀 Vercel Deployment - Schritt für Schritt

Diese Anleitung führt dich durch das komplette Vercel Deployment. Dauert ~5 Minuten.

## ✅ Voraussetzungen (bereits erledigt!)

- ✅ Code ist auf GitHub Branch `claude/bill-splitting-paypal-app-T3v1X`
- ✅ Supabase Storage Bucket erstellt
- ✅ Alle Credentials vorhanden

---

## 🎯 Schritt 1: Vercel Account erstellen (falls noch nicht)

1. Gehe zu [https://vercel.com/signup](https://vercel.com/signup)
2. Klicke auf **"Continue with GitHub"**
3. Autorisiere Vercel mit deinem GitHub Account
4. Du landest im Vercel Dashboard ✅

---

## 📦 Schritt 2: Projekt importieren

### 2.1 Import starten
1. Im Vercel Dashboard klicke auf **"Add New..."** → **"Project"**
2. Oder direkt: [https://vercel.com/new](https://vercel.com/new)

### 2.2 Repository auswählen
1. Du siehst eine Liste deiner GitHub Repositories
2. Suche nach **"RestoBill"**
3. Klicke auf **"Import"** neben RestoBill

### 2.3 Branch auswählen (WICHTIG!)
1. Bei "Git Branch" wähle: **`claude/bill-splitting-paypal-app-T3v1X`**
   - NICHT "main"!
   - Unser Code liegt auf diesem Feature-Branch

### 2.4 Framework Preset
- Sollte automatisch **"Next.js"** erkannt werden ✅
- Falls nicht: Wähle manuell "Next.js"

### 2.5 Root Directory
- Lasse **"."** (Standard) ✅

---

## 🔑 Schritt 3: Environment Variables hinzufügen

**WICHTIG:** Hier müssen ALLE 6 Variables rein!

### 3.1 Environment Variables Section öffnen
1. Scrolle runter zu **"Environment Variables"**
2. Klicke auf **"Show Advanced"** oder erweitere die Sektion

### 3.2 Füge alle 6 Variables hinzu:

Kopiere diese Werte und füge sie **EINZELN** ein:

**⚠️ WICHTIG:** Die exakten Werte findest du in deiner lokalen `.env.local` Datei!

Ich zeige dir hier die Keys, kopiere sie aus `.env.local`:

#### Variable 1: ANTHROPIC_API_KEY
```
Key:   ANTHROPIC_API_KEY
Value: [Kopiere aus .env.local - startet mit sk-ant-api03-...]
```
**Klick auf "Add"**

#### Variable 2: DATABASE_URL
```
Key:   DATABASE_URL
Value: [Kopiere aus .env.local - startet mit postgresql://...]
```
**Klick auf "Add"**

#### Variable 3: NEXT_PUBLIC_SUPABASE_URL
```
Key:   NEXT_PUBLIC_SUPABASE_URL
Value: https://iddnvilcnmaswxrlbhoo.supabase.co
```
**Klick auf "Add"**

#### Variable 4: NEXT_PUBLIC_SUPABASE_ANON_KEY
```
Key:   NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: [Kopiere aus .env.local - sehr langer eyJhbGc... String]
```
**Klick auf "Add"**

#### Variable 5: SUPABASE_SERVICE_ROLE_KEY
```
Key:   SUPABASE_SERVICE_ROLE_KEY
Value: [Kopiere aus .env.local - sehr langer eyJhbGc... String]
```
**Klick auf "Add"**

#### Variable 6: NEXT_PUBLIC_APP_URL
```
Key:   NEXT_PUBLIC_APP_URL
Value: https://YOUR-PROJECT-NAME.vercel.app
```
**⚠️ WICHTIG:** Ersetze `YOUR-PROJECT-NAME` mit deinem tatsächlichen Vercel Projekt-Namen!

Beispiel: `https://restobill.vercel.app`

Du kannst das auch erstmal leer lassen und nach dem Deploy aktualisieren.

**Klick auf "Add"**

### 3.3 Alle Variables prüfen
Du solltest jetzt **6 Environment Variables** sehen:
- ✅ ANTHROPIC_API_KEY
- ✅ DATABASE_URL
- ✅ NEXT_PUBLIC_SUPABASE_URL
- ✅ NEXT_PUBLIC_SUPABASE_ANON_KEY
- ✅ SUPABASE_SERVICE_ROLE_KEY
- ✅ NEXT_PUBLIC_APP_URL

---

## 🚀 Schritt 4: Deploy!

1. Klicke auf **"Deploy"**
2. Vercel startet jetzt den Build (dauert ~2-3 Minuten)
3. Du siehst Live-Logs vom Build-Prozess

**Was passiert:**
- ✅ Code wird von GitHub geholt
- ✅ Dependencies installiert
- ✅ Next.js wird gebaut
- ✅ App wird deployed

---

## 🎉 Schritt 5: Datenbank einrichten

**WICHTIG:** Nach dem ersten Deploy muss die Datenbank eingerichtet werden!

### 5.1 Deployment URL kopieren
Nach erfolgreichem Deploy siehst du:
- **"Congratulations!"** 🎉
- Deine App URL: `https://restobill-xyz.vercel.app`

### 5.2 Datenbank Schema pushen

#### Option A: Via Vercel CLI (Empfohlen)
```bash
# Lokal im Terminal:
npm install -g vercel
vercel login
vercel link
vercel env pull .env.local
npx prisma db push
```

#### Option B: Via Supabase SQL Editor (Einfacher!)

Gehe zu: [https://supabase.com/dashboard/project/iddnvilcnmaswxrlbhoo/sql/new](https://supabase.com/dashboard/project/iddnvilcnmaswxrlbhoo/sql/new)

Kopiere und führe diesen SQL Code aus:

```sql
-- Create Bill table
CREATE TABLE IF NOT EXISTS "Bill" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payerName" TEXT NOT NULL,
    "paypalHandle" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "restaurantName" TEXT,
    "totalAmount" DOUBLE PRECISION,
    "shareToken" TEXT NOT NULL,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Bill_shareToken_key" ON "Bill"("shareToken");
CREATE INDEX IF NOT EXISTS "Bill_shareToken_idx" ON "Bill"("shareToken");

-- Create BillItem table
CREATE TABLE IF NOT EXISTS "BillItem" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "pricePerUnit" DOUBLE PRECISION NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "BillItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BillItem_billId_idx" ON "BillItem"("billId");

-- Create Selection table
CREATE TABLE IF NOT EXISTS "Selection" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "friendName" TEXT NOT NULL,
    "itemQuantities" JSONB,
    "tipAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Selection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Selection_billId_idx" ON "Selection"("billId");

-- Create junction table for Selection-BillItem relationship
CREATE TABLE IF NOT EXISTS "_BillItemToSelection" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "_BillItemToSelection_AB_unique" ON "_BillItemToSelection"("A", "B");
CREATE INDEX IF NOT EXISTS "_BillItemToSelection_B_index" ON "_BillItemToSelection"("B");

-- Add foreign keys
ALTER TABLE "BillItem" DROP CONSTRAINT IF EXISTS "BillItem_billId_fkey";
ALTER TABLE "BillItem" ADD CONSTRAINT "BillItem_billId_fkey"
    FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Selection" DROP CONSTRAINT IF EXISTS "Selection_billId_fkey";
ALTER TABLE "Selection" ADD CONSTRAINT "Selection_billId_fkey"
    FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_BillItemToSelection" DROP CONSTRAINT IF EXISTS "_BillItemToSelection_A_fkey";
ALTER TABLE "_BillItemToSelection" ADD CONSTRAINT "_BillItemToSelection_A_fkey"
    FOREIGN KEY ("A") REFERENCES "BillItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_BillItemToSelection" DROP CONSTRAINT IF EXISTS "_BillItemToSelection_B_fkey";
ALTER TABLE "_BillItemToSelection" ADD CONSTRAINT "_BillItemToSelection_B_fkey"
    FOREIGN KEY ("B") REFERENCES "Selection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

Klicke auf **"Run"** ✅

---

## 🔄 Schritt 6: App URL aktualisieren (Optional aber empfohlen)

Jetzt wo du die echte Vercel URL kennst:

1. Gehe zu Vercel Dashboard → Dein Projekt → **Settings** → **Environment Variables**
2. Finde `NEXT_PUBLIC_APP_URL`
3. Klicke auf **"Edit"**
4. Ändere zu: `https://restobill-xyz.vercel.app` (deine echte URL)
5. Klicke auf **"Save"**
6. Gehe zu **Deployments** → Klicke auf **"Redeploy"**

---

## ✅ Schritt 7: Testen!

### 7.1 App öffnen
Öffne deine Vercel URL: `https://restobill-xyz.vercel.app`

Du solltest die **RestoBill Landing Page** sehen! 🎉

### 7.2 Vollständiger Test
1. Klicke "Jetzt Rechnung teilen"
2. Gib deinen Namen + PayPal Username ein
3. Lade ein Testbild einer Rechnung hoch
4. Warte ~5-10 Sekunden
5. **Die KI sollte automatisch alle Positionen extrahieren!** ✨
6. Kopiere den Share Link
7. Öffne in neuem Inkognito-Tab
8. Wähle Items aus, füge Tip hinzu
9. Klicke "Jetzt bezahlen"
10. **Du wirst zu PayPal.me weitergeleitet mit vorausgefülltem Betrag!** 💸

---

## 🐛 Troubleshooting

### Problem: Build Failed

**Fehlermeldung:** "Error: Environment variable not found"

**Lösung:**
- Prüfe ob alle 6 Environment Variables gesetzt sind
- Settings → Environment Variables → Alle da?

### Problem: "Database connection failed"

**Lösung:**
- SQL Schema aus Schritt 5.2 ausführen
- Database URL korrekt?

### Problem: "Failed to upload image"

**Lösung:**
- Supabase Storage Bucket `bill-images` erstellt?
- Ist der Bucket **public**?
- SQL Policies ausgeführt?

### Problem: "Claude API error"

**Lösung:**
- API Key in Vercel Environment Variables korrekt?
- Checke auf [console.anthropic.com](https://console.anthropic.com) ob Key aktiv ist

### Problem: Share Links zeigen localhost

**Lösung:**
- `NEXT_PUBLIC_APP_URL` in Vercel aktualisieren (Schritt 6)
- Redeploy

---

## 🎉 Fertig!

**Deine App ist jetzt live auf Vercel!** 🚀

### Nächste Schritte:

#### Custom Domain (Optional)
1. Vercel → Settings → Domains
2. "Add Domain" → z.B. `restobill.com`
3. DNS Records bei deinem Domain-Provider setzen
4. Fertig!

#### Monitoring
- Vercel Dashboard zeigt automatisch:
  - Analytics
  - Error logs
  - Performance metrics

#### Updates deployen
Jedes Mal wenn du Code auf GitHub pushst:
- ✅ Vercel deployed automatisch
- ✅ Du bekommst Preview-URLs
- ✅ Production wird nur deployed nach Approval

---

## 💰 Kosten

**Aktuell:**
- Vercel: **$0** (Free Tier - bis 100GB Bandwidth/Monat)
- Supabase: **$0** (Free Tier - bis 500MB DB + 1GB Storage)
- Claude API: **Pay-per-use** (~$0.03 pro Rechnung)

**Für 100 Rechnungen/Monat:** ~$3-5 total

---

## 📱 Mobil testen

Deine App ist jetzt **weltweit** erreichbar!

Öffne auf deinem Handy:
```
https://restobill-xyz.vercel.app
```

Funktioniert auf:
- ✅ iPhone
- ✅ Android
- ✅ Tablet
- ✅ Desktop

**Kein localhost mehr nötig!** 🎉

---

Bei Problemen: Schreib mir! Viel Erfolg! 🚀
