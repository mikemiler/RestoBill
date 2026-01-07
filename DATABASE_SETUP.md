# Datenbank Setup für RestoBill

## Problem

Die Entwicklungsumgebung kann weder auf Prisma-Binaries noch auf Supabase zugreifen:
- ❌ `binaries.prisma.sh` - 403 Forbidden
- ❌ `db.iddnvilcnmaswxrlbhoo.supabase.co` - DNS/Network blocked

Daher konnten die Datenbanktabellen nicht automatisch erstellt werden.

## Lösung: Manuelles Schema-Setup

Sie müssen das Datenbankschema **einmalig manuell** in Supabase erstellen.

### Schritt 1: Supabase SQL Editor öffnen

1. Gehen Sie zu: https://supabase.com/dashboard
2. Wählen Sie Ihr Projekt: `iddnvilcnmaswxrlbhoo`
3. Klicken Sie auf **SQL Editor** im linken Menü

### Schritt 2: Schema ausführen

1. Öffnen Sie die Datei: `prisma/init-schema.sql`
2. Kopieren Sie den **gesamten Inhalt** der Datei
3. Fügen Sie ihn in den SQL Editor ein
4. Klicken Sie auf **RUN** oder drücken Sie `Ctrl+Enter`

### Schritt 3: Überprüfung

Nach der Ausführung sollten Sie diese Erfolgsmeldung sehen:
```
✅ Tables created successfully!
```

Sie können die erstellten Tabellen überprüfen:
1. Gehen Sie zu **Table Editor** in Supabase
2. Sie sollten folgende Tabellen sehen:
   - `Bill` - Rechnungen
   - `BillItem` - Rechnungspositionen
   - `Selection` - Nutzerauswahl/Bestellungen
   - `_BillItemToSelection` - Verknüpfungstabelle

### Schritt 4: Deployment auf Vercel

Nach dem Schema-Setup ist die Anwendung bereit für Vercel:

```bash
# Code ist bereits gepusht auf:
# Branch: claude/fix-invoice-creation-error-cFH36

# In Vercel:
# 1. Import Repository: mikemiler/RestoBill
# 2. Branch auswählen: claude/fix-invoice-creation-error-cFH36
# 3. Environment Variables hinzufügen (aus .env):
#    - DATABASE_URL
#    - ANTHROPIC_API_KEY
#    - NEXT_PUBLIC_SUPABASE_URL
#    - NEXT_PUBLIC_SUPABASE_ANON_KEY
#    - SUPABASE_SERVICE_ROLE_KEY
# 4. Deploy!
```

## Alternative: Vercel Development

Wenn Sie Zugriff auf ein System mit funktionierendem Internet haben:

```bash
# Klonen des Repos
git clone https://github.com/mikemiler/RestoBill.git
cd RestoBill
git checkout claude/fix-invoice-creation-error-cFH36

# .env konfigurieren
cp .env.example .env
# Fügen Sie Ihre echten Credentials ein

# Setup
npm install
npx prisma generate  # Sollte funktionieren wenn Internet OK
npx prisma db push   # Pusht Schema zu Supabase

# Development
npm run dev
```

## Datenbank-Schema Übersicht

### Bill (Rechnung)
- Speichert Rechnungsinformationen
- Generiert automatisch shareToken für öffentlichen Zugriff
- Enthält PayPal-Handle für Zahlungen

### BillItem (Rechnungsposition)
- Einzelne Positionen einer Rechnung
- Name, Menge, Preis pro Einheit
- Gehört zu genau einer Bill

### Selection (Auswahl/Bestellung)
- Was ein Freund bestellt/zahlen möchte
- Verknüpft mit mehreren BillItems
- Enthält Trinkgeld und Zahlungsstatus

### _BillItemToSelection
- Many-to-Many Beziehung
- Ein Selection kann mehrere Items haben
- Ein Item kann in mehreren Selections sein

## Sicherheit

✅ Alle Tabellen nutzen:
- UUID als Primary Keys
- CASCADE DELETE für referenzielle Integrität
- Indizes für Performance
- JSONB für flexible Datenstrukturen

## Support

Bei Problemen:
1. Überprüfen Sie die Supabase Logs
2. Prüfen Sie, ob alle Tabellen erstellt wurden
3. Testen Sie die Verbindung in Vercel

Die Anwendung sollte nach dem Schema-Setup voll funktionsfähig sein! 🚀
