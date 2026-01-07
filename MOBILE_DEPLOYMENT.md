# 📱 RestoBill Deployment vom Handy

## Schnellstart - 3 einfache Schritte

Alles ist vorbereitet! Sie müssen nur noch deployen:

---

## Schritt 1: Zu Vercel gehen (2 Minuten)

### Option A: Neues Projekt auf Vercel (Empfohlen)

1. Öffnen Sie: https://vercel.com/new
2. Loggen Sie sich ein (GitHub/GitLab/Email)
3. **Import Git Repository**:
   - Suchen Sie nach: `mikemiler/RestoBill`
   - Oder URL: `https://github.com/mikemiler/RestoBill`
4. **Configure Project**:
   - Branch: `claude/fix-invoice-creation-error-cFH36`
   - Root Directory: `./` (Standard)
   - Framework Preset: Next.js (wird automatisch erkannt)

---

## Schritt 2: Environment Variables setzen (3 Minuten)

Klappen Sie **Environment Variables** auf und fügen Sie hinzu:

```
Name: DATABASE_URL
Value: postgresql://postgres:restobill0815@db.iddnvilcnmaswxrlbhoo.supabase.co:5432/postgres
✓ Production  ✓ Preview  ✓ Development

Name: ANTHROPIC_API_KEY
Value: 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
✓ Production  ✓ Preview  ✓ Development

Name: NEXT_PUBLIC_SUPABASE_URL
Value: https://iddnvilcnmaswxrlbhoo.supabase.co
✓ Production  ✓ Preview  ✓ Development

Name: NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkZG52aWxjbm1hc3d4cmxiaG9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4MDYwODIsImV4cCI6MjA4MzM4MjA4Mn0.y-jVZs9McdP2WIPqSOQzA1rrfRJhEVJZuQwAbgGSj0c
✓ Production  ✓ Preview  ✓ Development

Name: SUPABASE_SERVICE_ROLE_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkZG52aWxjbm1hc3d4cmxiaG9vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzgwNjA4MiwiZXhwIjoyMDgzMzgyMDgyfQ.lnh3pa0QV_ngksVO9E4S6hCHhVOk3ly5xw5_m1e9EGc
✓ Production  ✓ Preview  ✓ Development
```

**Tipp**: Kopieren Sie jeden Wert einzeln - am Handy funktioniert das am besten!

---

## Schritt 3: Deploy! (1 Klick)

Klicken Sie auf **Deploy**

Vercel wird:
- ✅ Code klonen
- ✅ Dependencies installieren
- ✅ Prisma Client generieren (funktioniert auf Vercel!)
- ✅ Next.js Build durchführen
- ✅ Deployen

**Dauer**: Ca. 2-3 Minuten

---

## Schritt 4: Datenbank-Schema erstellen (2 Minuten)

**WICHTIG**: Dies muss gemacht werden, damit die App funktioniert!

1. Öffnen Sie: https://supabase.com/dashboard
2. Wählen Sie Ihr Projekt: `iddnvilcnmaswxrlbhoo`
3. Gehen Sie zu: **SQL Editor**
4. Klicken Sie auf: **New query**
5. Kopieren Sie den Inhalt von `prisma/init-schema.sql` (siehe unten)
6. Fügen Sie ein und klicken Sie: **RUN**

### SQL Script zum Kopieren:

<details>
<summary>👉 Klicken Sie hier für das SQL Script</summary>

```sql
-- RestoBill Database Schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS "Bill" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payerName" TEXT NOT NULL,
    "paypalHandle" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "restaurantName" TEXT,
    "totalAmount" DOUBLE PRECISION,
    "shareToken" TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::TEXT
);

CREATE INDEX IF NOT EXISTS "Bill_shareToken_idx" ON "Bill"("shareToken");

CREATE TABLE IF NOT EXISTS "BillItem" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    "billId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "pricePerUnit" DOUBLE PRECISION NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "BillItem_billId_fkey" FOREIGN KEY ("billId")
        REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "BillItem_billId_idx" ON "BillItem"("billId");

CREATE TABLE IF NOT EXISTS "Selection" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    "billId" TEXT NOT NULL,
    "friendName" TEXT NOT NULL,
    "itemQuantities" JSONB,
    "tipAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Selection_billId_fkey" FOREIGN KEY ("billId")
        REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Selection_billId_idx" ON "Selection"("billId");

CREATE TABLE IF NOT EXISTS "_BillItemToSelection" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_BillItemToSelection_A_fkey" FOREIGN KEY ("A")
        REFERENCES "BillItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_BillItemToSelection_B_fkey" FOREIGN KEY ("B")
        REFERENCES "Selection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "_BillItemToSelection_AB_unique" ON "_BillItemToSelection"("A", "B");
CREATE INDEX IF NOT EXISTS "_BillItemToSelection_B_idx" ON "_BillItemToSelection"("B");
```

</details>

Sie sehen dann: `✅ Success. No rows returned`

---

## Fertig! 🎉

Ihre App ist jetzt live unter der Vercel-URL (z.B. `restobill.vercel.app`)

---

## ⚠️ Wichtig nach Deployment:

### Sicherheit (siehe SECURITY_NOTICE.md):
Da die API-Keys im Git waren, sollten Sie rotieren:

1. **Anthropic API Key**: https://console.anthropic.com/settings/keys
2. **Supabase Keys**: https://supabase.com/dashboard/project/iddnvilcnmaswxrlbhoo/settings/api
3. Dann in Vercel aktualisieren: Settings → Environment Variables

---

## Troubleshooting

### Build Failed: "Prisma Client not generated"
→ Sollte nicht passieren (vercel.json ist konfiguriert)
→ Falls doch: Fügen Sie `PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1` zu Env Vars hinzu

### "Database connection failed"
→ Haben Sie das SQL-Schema in Supabase ausgeführt? (Schritt 4)
→ Überprüfen Sie DATABASE_URL in Vercel Environment Variables

### "Fehler beim Erstellen der Rechnung"
→ Datenbank-Tabellen fehlen! Führen Sie SQL-Script aus (Schritt 4)

---

## Alternative: Über GitHub deployen

Falls Vercel Import nicht funktioniert:

1. Gehen Sie zu: https://github.com/mikemiler/RestoBill/settings
2. Unter **Integrations**: Vercel App autorisieren
3. Vercel wird automatisch erkennen und deployen

---

## Quick Links

- Vercel Dashboard: https://vercel.com/dashboard
- Neues Projekt: https://vercel.com/new
- Supabase Dashboard: https://supabase.com/dashboard
- GitHub Repo: https://github.com/mikemiler/RestoBill

---

## Zusammenfassung

```
1. vercel.com/new → Import mikemiler/RestoBill
2. Branch: claude/fix-invoice-creation-error-cFH36
3. 5 Environment Variables eintragen (siehe oben)
4. Deploy klicken
5. SQL Script in Supabase ausführen
6. ✅ App testen!
```

**Geschätzte Zeit**: 8-10 Minuten insgesamt
