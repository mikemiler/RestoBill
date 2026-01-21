# Default Branch Setup - main

## Aktueller Status
✅ Der `main` Branch ist lokal konfiguriert und mit `origin/main` verbunden.

## GitHub Default Branch einstellen

Um `main` als Standard-Branch auf GitHub zu setzen (sodass alle neuen PRs automatisch gegen `main` gehen):

### Option 1: GitHub Web Interface (Empfohlen)
1. Gehe zu: https://github.com/mikemiler/RestoBill/settings/branches
2. Unter "Default branch" klicke auf den Switch-Button (⇄)
3. Wähle `main` aus der Dropdown-Liste
4. Bestätige mit "Update"

### Option 2: GitHub CLI (falls installiert)
```bash
gh repo edit --default-branch main
```

### Option 3: GitHub API (mit Personal Access Token)
```bash
curl -X PATCH \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer YOUR_GITHUB_TOKEN" \
  https://api.github.com/repos/mikemiler/RestoBill \
  -d '{"default_branch":"main"}'
```

## Verifizierung
Nach der Änderung sollte:
- Die Repository-Hauptseite den `main` Branch als Standard anzeigen
- Neue Pull Requests automatisch gegen `main` erstellt werden
- Der Branch-Selector auf GitHub `main` als Standard anzeigen

## Hinweise für Claude Code
Nach der Einrichtung werden alle Feature-Branches von `main` abzweigen und PRs gegen `main` erstellt.
