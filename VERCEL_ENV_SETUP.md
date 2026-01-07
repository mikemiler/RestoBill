# Vercel Environment Variables Setup

## Wichtig zu verstehen

⚠️ **Vercel liest NICHT die `.env` Datei aus dem Repository!**

Die `.env` Datei ist in `.gitignore` und wird nicht deployed. Sie ist nur für lokale Entwicklung gedacht.

Für Vercel müssen Sie die Environment-Variablen **separat konfigurieren**.

## Option 1: Automatisches Setup (Empfohlen)

### Voraussetzungen
```bash
# Vercel CLI installieren (falls nicht vorhanden)
npm install -g vercel

# In Vercel einloggen
vercel login
```

### Setup durchführen

```bash
# Im Projektverzeichnis:
./setup-vercel-env.sh
```

Das Script:
1. Liest alle Werte aus Ihrer `.env` Datei
2. Setzt sie automatisch in Vercel für Production
3. Fragt optional nach Preview/Development Setup

## Option 2: Manuelles Setup via Vercel Dashboard

### Schritt 1: Vercel Dashboard öffnen
1. Gehen Sie zu: https://vercel.com/dashboard
2. Wählen Sie Ihr Projekt (RestoBill)
3. Gehen Sie zu: Settings → Environment Variables

### Schritt 2: Variablen einzeln hinzufügen

Fügen Sie folgende Variablen hinzu (Werte aus Ihrer `.env` Datei):

#### DATABASE_URL
```
Name: DATABASE_URL
Value: postgresql://postgres:restobill0815@db.iddnvilcnmaswxrlbhoo.supabase.co:5432/postgres
Environments: Production, Preview, Development (alle auswählen)
```

#### ANTHROPIC_API_KEY
```
Name: ANTHROPIC_API_KEY
Value: sk-ant-api03-... (Ihr API Key aus .env)
Environments: Production, Preview, Development
```

#### NEXT_PUBLIC_SUPABASE_URL
```
Name: NEXT_PUBLIC_SUPABASE_URL
Value: https://iddnvilcnmaswxrlbhoo.supabase.co
Environments: Production, Preview, Development
```

#### NEXT_PUBLIC_SUPABASE_ANON_KEY
```
Name: NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (Ihr Key aus .env)
Environments: Production, Preview, Development
```

#### SUPABASE_SERVICE_ROLE_KEY
```
Name: SUPABASE_SERVICE_ROLE_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (Ihr Key aus .env)
Environments: Production, Preview, Development
```

### Schritt 3: Deployment auslösen

Nach dem Setzen der Environment-Variablen:
```bash
# Neues Deployment auslösen
vercel --prod

# Oder über das Dashboard: Redeploy Button klicken
```

## Option 3: Via Vercel CLI (Einzeln)

Falls Sie jede Variable manuell via CLI setzen möchten:

```bash
# Link zum Vercel-Projekt erstellen (einmalig)
vercel link

# Environment-Variablen setzen
vercel env add DATABASE_URL production
# Dann Wert eingeben wenn gefragt

vercel env add ANTHROPIC_API_KEY production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
```

## Überprüfung

Nach dem Setup können Sie die Variablen überprüfen:

```bash
# Via CLI
vercel env ls

# Oder im Dashboard unter:
# Settings → Environment Variables
```

## Wichtige Hinweise

### NEXT_PUBLIC_* Variablen
- Variablen mit `NEXT_PUBLIC_` Prefix werden im Client-seitigen Code verfügbar
- Diese sind in der deployed App öffentlich sichtbar (Browser)
- Nur unkritische Werte hier verwenden!

### Geheime Variablen
- `DATABASE_URL`, `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` sind geheim
- Diese sind nur serverseitig verfügbar
- Niemals im Client-Code verwenden!

### Nach Änderungen
- Änderungen an Environment-Variablen erfordern ein **Redeploy**
- Vercel aktualisiert sie nicht automatisch in laufenden Deployments

## Deployment Workflow

```bash
# 1. Datenbank-Schema erstellen (siehe DATABASE_SETUP.md)
# In Supabase SQL Editor: prisma/init-schema.sql ausführen

# 2. Environment-Variablen setzen
./setup-vercel-env.sh
# ODER manuell im Dashboard

# 3. Deployen
vercel --prod

# 4. Testen
# Öffnen Sie die Vercel-URL und testen Sie die App
```

## Troubleshooting

### "Environment variable not found"
- Überprüfen Sie, ob alle Variablen gesetzt sind: `vercel env ls`
- Stellen Sie sicher, dass Sie für die richtige Environment (production/preview) deployen

### "Database connection failed"
- Überprüfen Sie DATABASE_URL Format
- Testen Sie die Verbindung in Supabase Dashboard
- Stellen Sie sicher, dass die Tabellen existieren (siehe DATABASE_SETUP.md)

### "ANTHROPIC_API_KEY invalid"
- Überprüfen Sie, ob der Key korrekt kopiert wurde (keine Leerzeichen)
- Testen Sie den Key in Anthropic Console

## Sicherheit

✅ **Tun Sie das:**
- Environment-Variablen via Vercel Dashboard/CLI setzen
- `.env` in `.gitignore` belassen
- Regelmäßig Keys rotieren

❌ **Tun Sie das NICHT:**
- `.env` ins Git-Repository committen
- API Keys im Code hardcoden
- Geheime Keys als `NEXT_PUBLIC_*` Variablen verwenden
