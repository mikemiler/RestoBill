# 🚀 Quick Start Guide

Deine RestoBill App ist **fast** fertig! Folge diesen Schritten um sie zu starten:

## ✅ Was du bereits hast:

- ✅ Code ist fertig und committed
- ✅ `.env.local` mit allen Credentials erstellt
- ✅ Supabase Projekt läuft
- ✅ Claude API Key aktiviert

## 📋 Was noch fehlt (5 Minuten):

### Schritt 1: Setup Script ausführen

Öffne ein Terminal im RestoBill Ordner und führe aus:

```bash
chmod +x setup.sh
./setup.sh
```

Das Script:
- ✅ Installiert Dependencies
- ✅ Generiert Prisma Client
- ✅ Erstellt Datenbank-Tabellen in Supabase

**Erwartete Ausgabe:**
```
🚀 RestoBill Setup Script
✅ .env.local found
📦 Installing dependencies...
🔧 Generating Prisma Client...
🗄️  Pushing database schema to Supabase...
✅ Setup complete!
```

### Schritt 2: Supabase Storage Bucket erstellen

Folge der Anleitung in **SUPABASE_SETUP.md**:

1. Öffne Supabase Dashboard
2. Erstelle Bucket `bill-images` (public)
3. Führe SQL Policies aus

**Dauert:** ~2 Minuten

### Schritt 3: App starten! 🎉

```bash
npm run dev
```

Öffne im Browser: **http://localhost:3000**

---

## 🧪 Testen

### Test 1: Landing Page
- Öffne `http://localhost:3000`
- Du solltest die RestoBill Landing Page sehen
- Klicke auf "Jetzt Rechnung teilen"

### Test 2: Rechnung erstellen
1. Gib deinen Namen ein
2. Gib deinen PayPal Username ein (z.B. `deinusername`)
3. Klicke "Weiter zur Rechnung"

### Test 3: Bild hochladen
1. Lade ein Testbild einer Rechnung hoch
2. Klicke "Hochladen & Analysieren"
3. Warte ~5-10 Sekunden
4. Die KI sollte automatisch alle Positionen extrahieren!

### Test 4: Share Link
1. Kopiere den Share Link
2. Öffne ihn in einem neuen Inkognito-Tab
3. Simuliere einen Freund der seine Positionen auswählt

---

## 📱 Auf Handy testen

**Computer und Handy im gleichen WLAN?** Dann kannst du testen!

### Finde deine IP:

```bash
hostname -I | awk '{print $1}'
```

Beispiel: `192.168.1.100`

### Auf Handy öffnen:

```
http://192.168.1.100:3000
```

**Wichtig:** Port 3000 muss in Firewall erlaubt sein!

---

## 🐛 Troubleshooting

### Problem: "Prisma Client not generated"

**Lösung:**
```bash
npx prisma generate
```

### Problem: "Database connection failed"

**Lösung:** Prüfe `.env.local`:
- Database URL korrekt?
- Passwort `restobill0815` eingesetzt?

Teste Verbindung:
```bash
npx prisma db push
```

### Problem: "Failed to upload image"

**Lösung:** Supabase Storage Bucket fehlt!
→ Siehe **SUPABASE_SETUP.md**

### Problem: "Claude API error"

**Lösung:** Prüfe `.env.local`:
- API Key korrekt?
- API Key startet mit `sk-ant-api03-`?

Teste:
```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01"
```

---

## 🌐 Deployment auf Vercel (Optional)

Wenn alles lokal funktioniert, kannst du deployen:

### 1. GitHub Repo erstellen (falls noch nicht)

```bash
git remote add origin https://github.com/deinusername/RestoBill.git
git push -u origin main
```

### 2. Vercel Setup

1. Gehe zu [vercel.com](https://vercel.com)
2. "Import Git Repository"
3. Wähle RestoBill Repo
4. **Environment Variables** hinzufügen:
   - Kopiere alle aus `.env.local`
   - ⚠️ Ändere `NEXT_PUBLIC_APP_URL` zu deiner Vercel URL!

5. Deploy!

### 3. Nach dem Deploy

Update die App URL in Vercel:
```
NEXT_PUBLIC_APP_URL=https://restobill.vercel.app
```

Redeploy und fertig! 🎉

---

## 💰 Kosten Übersicht

**Aktueller Status:**
- Vercel: $0 (Free Tier)
- Supabase: $0 (Free Tier)
- Claude API: Pay-per-use (~$0.03 pro Rechnung)

**Für 100 Rechnungen/Monat:** ~$3-5 total

---

## 📚 Weitere Dokumentation

- **README.md** - Komplette Dokumentation
- **SUPABASE_SETUP.md** - Storage Bucket Setup
- **PLAN.md** - Original Implementierungsplan
- **.env.example** - Environment Variables Vorlage

---

## ✅ Checkliste

- [ ] Setup Script ausgeführt (`./setup.sh`)
- [ ] Supabase Storage Bucket erstellt
- [ ] App läuft lokal (`npm run dev`)
- [ ] Landing Page erreichbar
- [ ] Testrechnung erstellt
- [ ] Bild hochgeladen und analysiert
- [ ] Share Link funktioniert

**Alles ✅? Du bist fertig!** 🎉

Bei Problemen: Siehe Troubleshooting oben oder README.md
