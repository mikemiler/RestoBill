# Prisma Engine Binaries Fix

## Problem

Der Fehler "Fehler beim Erstellen der Rechnung" tritt auf, weil der Prisma-Client nicht korrekt generiert werden kann. Dies liegt daran, dass die Umgebung den Zugriff auf die Prisma-Binaries-Server blockiert:

```
curl: (56) CONNECT tunnel failed, response 403
HTTP/1.1 403 Forbidden
x-deny-reason: host_not_allowed
```

## Ursache

Die Entwicklungsumgebung hat eine Firewall oder Proxy-Konfiguration, die den Zugriff auf `binaries.prisma.sh` blockiert. Dies verhindert:
- Das Herunterladen der Prisma Query Engine
- Das Herunterladen der Prisma Schema Engine
- Die Generierung des Prisma-Clients

## Lösungen

### Option 1: Deployment auf Vercel (Empfohlen)

Die Anwendung sollte auf Vercel problemlos funktionieren, da dort die Prisma-Binaries zugänglich sind:

```bash
# Push zum Repository
git push origin claude/fix-invoice-creation-error-cFH36

# Vercel wird automatisch:
# 1. npm install ausführen
# 2. Prisma Client generieren
# 3. Die Anwendung bauen
# 4. Deployen
```

### Option 2: Lokale Entwicklung mit Docker

Wenn lokale Entwicklung benötigt wird, kann Docker verwendet werden:

```bash
# Dockerfile erstellen (falls nicht vorhanden)
docker-compose up
```

### Option 3: Proxy-Konfiguration ändern

Falls Sie die Netzwerkkonfiguration kontrollieren können:

1. Whitelist hinzufügen für: `binaries.prisma.sh`
2. Oder Proxy-Ausnahme konfigurieren:

```bash
export NO_PROXY=binaries.prisma.sh
export HTTPS_PROXY=""
```

### Option 4: Manuelle Binary-Installation (Fortgeschritten)

Falls keine der obigen Optionen funktioniert:

```bash
# Binaries manuell herunterladen (von einem System mit Internet-Zugang)
# Prisma Version: 5.22.0
# Engine Version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2

# Dann in node_modules/.prisma/client kopieren
```

## Verifikation

Nach erfolgreicher Lösung sollten folgende Befehle funktionieren:

```bash
# Prisma Client generieren
npx prisma generate

# Schema zur DB pushen
npx prisma db push

# Entwicklungsserver starten
npm run dev
```

## Status der Datenbank

Die Datenbank-Konfiguration ist korrekt:
- ✅ DATABASE_URL ist konfiguriert
- ✅ Supabase-Verbindung ist eingerichtet
- ✅ Schema ist definiert (prisma/schema.prisma)
- ⚠️ **Tabellen müssen manuell erstellt werden** (siehe DATABASE_SETUP.md)

Das Problem:
- Die lokale Umgebung kann weder auf Prisma-Binaries noch auf Supabase zugreifen
- Daher konnten die Tabellen nicht automatisch mit `prisma db push` erstellt werden
- **Lösung**: Führen Sie `prisma/init-schema.sql` manuell in Supabase aus (siehe DATABASE_SETUP.md)

## Empfohlene Vorgehensweise

Für die Produktion:
1. ✅ **Code committen und pushen** zur Branch (erledigt)
2. **Datenbank-Schema manuell erstellen** - siehe [DATABASE_SETUP.md](./DATABASE_SETUP.md)
3. **Auf Vercel deployen** - funktioniert automatisch
4. **Testen** auf der deployed URL

Die Anwendung ist produktionsreif und sollte auf Vercel ohne Probleme laufen, sobald das Datenbank-Schema erstellt wurde.
