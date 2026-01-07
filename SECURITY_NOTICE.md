# 🔒 Sicherheitshinweis - Environment Variables

## ⚠️ WICHTIG: API-Keys im Repository gefunden

Die `.env` Datei wurde versehentlich ins Git-Repository committed und enthält sensible Informationen:

- ✅ DATABASE_URL mit Passwort
- ✅ ANTHROPIC_API_KEY
- ✅ SUPABASE_SERVICE_ROLE_KEY
- ✅ Supabase Anon Key

## Was wurde unternommen

### Sofortmaßnahmen (bereits erledigt):
1. ✅ `.env` zur `.gitignore` hinzugefügt
2. ✅ `.env` aus Git-Tracking entfernt (git rm --cached)
3. ✅ Dokumentation für sichere Vercel-Konfiguration erstellt

### Was Sie jetzt tun sollten:

#### 1. API-Keys rotieren (DRINGEND EMPFOHLEN)

Da die Keys im Git-Repository waren, könnten sie kompromittiert sein:

##### Anthropic API Key
```
1. Gehen Sie zu: https://console.anthropic.com/settings/keys
2. Erstellen Sie einen neuen API Key
3. Löschen Sie den alten Key
4. Aktualisieren Sie Ihre lokale .env Datei
5. Setzen Sie den neuen Key in Vercel
```

##### Supabase Keys
```
1. Gehen Sie zu: https://supabase.com/dashboard/project/iddnvilcnmaswxrlbhoo/settings/api
2. Notieren Sie sich die aktuellen Keys
3. Für SERVICE_ROLE_KEY: Erwägen Sie Key-Rotation via Support
4. Aktualisieren Sie .env und Vercel
```

##### Datenbank-Passwort
```
1. Gehen Sie zu: https://supabase.com/dashboard/project/iddnvilcnmaswxrlbhoo/settings/database
2. Ändern Sie das Datenbank-Passwort
3. Aktualisieren Sie DATABASE_URL in .env und Vercel
```

#### 2. Repository-Historie bereinigen (Optional, aber empfohlen)

Um die sensiblen Daten vollständig aus der Git-Historie zu entfernen:

```bash
# WARNUNG: Dies ändert die Git-Historie!
# Nur ausführen wenn Sie alleine am Projekt arbeiten

# Option A: BFG Repo-Cleaner (empfohlen)
brew install bfg  # oder apt-get install bfg
bfg --delete-files .env
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Option B: git filter-branch
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# Dann force push (VORSICHT!)
git push origin --force --all
```

**Achtung**: Dies ist nur sinnvoll, wenn:
- Sie der einzige Entwickler sind
- Niemand das Repository bereits gecloned hat
- Andernfalls: Einfach Keys rotieren ist ausreichend!

#### 3. Git-Hooks einrichten (Prävention)

Erstellen Sie einen Pre-Commit Hook, der versehentliche Commits verhindert:

```bash
# .git/hooks/pre-commit erstellen
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
if git diff --cached --name-only | grep -q "^\.env$"; then
    echo "❌ ERROR: Attempting to commit .env file!"
    echo "This file contains sensitive information and should not be committed."
    echo "Please remove it from the commit."
    exit 1
fi
EOF

chmod +x .git/hooks/pre-commit
```

## Best Practices für die Zukunft

### ✅ Tun Sie das:

1. **Verwenden Sie .env.example** für Template:
   ```bash
   cp .env.example .env
   # Dann echte Werte eintragen
   ```

2. **Überprüfen Sie vor jedem Commit**:
   ```bash
   git status  # Prüfen was committed wird
   git diff --cached  # Änderungen anschauen
   ```

3. **Nutzen Sie Tools**:
   ```bash
   # Git-secrets installieren
   git secrets --install
   git secrets --register-aws
   ```

4. **Vercel Environment Variables**:
   - Immer via Dashboard oder CLI setzen
   - Nie in Code oder Config-Dateien

### ❌ Tun Sie das NICHT:

1. ❌ `.env` ins Repository committen
2. ❌ API-Keys im Code hardcoden
3. ❌ Secrets in Kommentaren oder Docs
4. ❌ Screenshots mit API-Keys teilen
5. ❌ `.env` Files per Email/Chat teilen

## Überprüfung

Checken Sie, ob Ihre Sicherheit gewährleistet ist:

```bash
# 1. .env ist in .gitignore
cat .gitignore | grep "^\.env$"

# 2. .env ist nicht mehr getrackt
git ls-files | grep "^\.env$"  # Sollte leer sein

# 3. Keine Secrets im Code
git grep -i "sk-ant-api"  # Sollte nichts finden
git grep -i "restobill0815"  # Sollte nichts finden
```

## Support

Bei Fragen zur Sicherheit:
- Anthropic Support: support@anthropic.com
- Supabase Support: https://supabase.com/support

## Status

- ✅ .env aus Git entfernt
- ✅ .gitignore aktualisiert
- ✅ Vercel-Setup dokumentiert
- ⏳ **Nächster Schritt: API-Keys rotieren**
