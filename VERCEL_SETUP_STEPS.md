# Vercel Environment Setup - Schritt für Schritt

## Aktueller Status
✅ Vercel CLI ist installiert (Version 50.1.6)
✅ .env Datei ist vorhanden mit allen Werten
✅ Setup-Scripts sind bereit

## Führen Sie diese Befehle aus:

### Schritt 1: Vercel Login
```bash
vercel login
```

Folgen Sie den Anweisungen:
- Wählen Sie Ihre Login-Methode (GitHub, GitLab, Bitbucket, oder Email)
- Ein Browser-Fenster öffnet sich
- Autorisieren Sie den Login
- Warten Sie auf Bestätigung im Terminal

### Schritt 2: Projekt mit Vercel verlinken
```bash
vercel link
```

Sie werden gefragt:
1. **Set up and deploy?** → Wählen Sie `N` (No) - wir wollen nur verlinken
2. **Which scope?** → Wählen Sie Ihren Account/Team
3. **Link to existing project?** → Wählen Sie:
   - `Y` (Yes) falls RestoBill schon existiert
   - `N` (No) für neues Projekt
4. **Project name?** → `RestoBill` (oder wie Sie möchten)

### Schritt 3: Environment Variables automatisch setzen
```bash
./setup-vercel-env-auto.sh
```

Dieses Script:
- Liest alle Werte aus `.env`
- Setzt sie automatisch in Vercel
- Für Production, Preview UND Development
- Nicht-interaktiv, läuft komplett automatisch

### Alternative: Manuelles Setup (falls Script nicht funktioniert)

Falls das automatische Script Probleme macht:

```bash
# Jede Variable einzeln setzen
source .env

# Production
echo "$DATABASE_URL" | vercel env add DATABASE_URL production
echo "$ANTHROPIC_API_KEY" | vercel env add ANTHROPIC_API_KEY production
echo "$NEXT_PUBLIC_SUPABASE_URL" | vercel env add NEXT_PUBLIC_SUPABASE_URL production
echo "$NEXT_PUBLIC_SUPABASE_ANON_KEY" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
echo "$SUPABASE_SERVICE_ROLE_KEY" | vercel env add SUPABASE_SERVICE_ROLE_KEY production

# Preview (optional)
echo "$DATABASE_URL" | vercel env add DATABASE_URL preview
echo "$ANTHROPIC_API_KEY" | vercel env add ANTHROPIC_API_KEY preview
echo "$NEXT_PUBLIC_SUPABASE_URL" | vercel env add NEXT_PUBLIC_SUPABASE_URL preview
echo "$NEXT_PUBLIC_SUPABASE_ANON_KEY" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview
echo "$SUPABASE_SERVICE_ROLE_KEY" | vercel env add SUPABASE_SERVICE_ROLE_KEY preview
```

### Schritt 4: Environment Variables überprüfen
```bash
vercel env ls
```

Sie sollten sehen:
- DATABASE_URL
- ANTHROPIC_API_KEY
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

Für alle drei Environments: Production, Preview, Development

### Schritt 5: Deployen
```bash
# Für Production
vercel --prod

# ODER einfach
vercel deploy --prod
```

## Troubleshooting

### "Error: No existing credentials found"
→ Führen Sie `vercel login` erneut aus

### "Error: Project not found"
→ Führen Sie `vercel link` erneut aus

### "Error: Failed to add environment variable"
→ Variable existiert bereits. Löschen Sie sie zuerst:
```bash
vercel env rm VARIABLE_NAME production
```

### Script-Fehler
→ Nutzen Sie das manuelle Setup (siehe oben)

## Nach dem Setup

1. ✅ Deployen Sie das Projekt
2. ⚠️ **WICHTIG**: Rotieren Sie Ihre API-Keys (siehe SECURITY_NOTICE.md)
3. 📊 Erstellen Sie die Datenbank-Tabellen (siehe DATABASE_SETUP.md)
4. 🎉 Testen Sie die Anwendung!

## Schnell-Übersicht

```bash
# Komplett-Setup in 4 Schritten:
vercel login                      # 1. Login
vercel link                       # 2. Projekt verlinken
./setup-vercel-env-auto.sh        # 3. Env vars setzen
vercel --prod                     # 4. Deployen

# Danach:
# - API-Keys rotieren (SECURITY_NOTICE.md)
# - DB-Schema erstellen (DATABASE_SETUP.md)
```

---

**Hinweis**: Alle diese Befehle müssen im Projekt-Verzeichnis (`/home/user/RestoBill`) ausgeführt werden.
