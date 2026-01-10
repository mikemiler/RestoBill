# Live Selection Debug Guide

## Problem
Wenn Gast A auf "1x" klickt, sieht Gast B den Badge nicht live.

## Debug-Schritte

### Schritt 1: Öffne Browser Console (F12)

Führe einen Test mit 2 Browser-Tabs durch:

**Tab 1 (Alice):**
1. Öffne Split-Link
2. Öffne Console (F12)
3. Gib Name "Alice" ein

**Tab 2 (Bob):**
1. Öffne selben Split-Link
2. Öffne Console (F12)
3. Gib Name "Bob" ein
4. Klicke auf "1x" bei einer Position (z.B. Pizza)

### Schritt 2: Analysiere Console Logs in Tab 2 (Bob)

Wenn Bob auf "1x" klickt, solltest du sehen:

```
🔵 [User Action] Item quantity changed: { itemId: "abc12345", quantity: 1 }
🔵 [Live Selection] Current guest name: Bob
🔵 [Live Selection] Sending API request to /api/live-selections/update
✅ [Live Selection] API success: { success: true }
```

**Falls du siehst:**
- `⚠️ [Live Selection] Skipped - no guest name set` → **Problem:** Name ist nicht gesetzt
  - Lösung: Stelle sicher dass du Name eingegeben hast

- `❌ [Live Selection] API error: ...` → **Problem:** API schlägt fehl
  - Lösung: Prüfe Fehlermeldung, möglicherweise DB-Problem

- `❌ [Live Selection] Fetch error: ...` → **Problem:** Network-Fehler
  - Lösung: Prüfe Network-Tab in DevTools

### Schritt 3: Analysiere Console Logs in Tab 1 (Alice)

In Alice's Tab solltest du kurz nach Bob's Klick sehen:

```
🟢 [Realtime] ActiveSelection change detected: { eventType: "INSERT", ... }
🟢 [Realtime] Fetching live selections from API...
🟢 [Realtime] Received live selections: 1 items [{ guestName: "Bob", quantity: 1, ... }]
🟢 [Realtime] Grouped by itemId: 1 items have selections
🎨 [Badge Render] {
  itemName: "Pizza",
  currentGuestName: "Alice",
  liveUsersCount: 1,
  liveUsers: [{ name: "Bob", qty: 1 }],
  othersSelectingCount: 1,
  othersSelecting: [{ name: "Bob", qty: 1 }]
}
```

**Falls KEINE Realtime Events erscheinen:**
→ **Problem:** Supabase Realtime ist nicht konfiguriert
→ **Lösung:** Siehe Schritt 4

**Falls `othersSelectingCount: 0` obwohl `liveUsersCount: 1`:**
→ **Problem:** Name-Matching schlägt fehl
→ Prüfe dass `currentGuestName` ≠ `Bob`

### Schritt 4: Prüfe Supabase Realtime Konfiguration

Führe aus:
```bash
npx ts-node test-realtime-config.ts
```

Erwartete Ausgabe:
```
📡 ActiveSelection subscription status: SUBSCRIBED
📡 Selection subscription status: SUBSCRIBED
```

**Falls Status ≠ "SUBSCRIBED":**

1. Gehe zu Supabase Dashboard
2. Database → Publications → `supabase_realtime`
3. Klicke "Edit publication"
4. Stelle sicher dass aktiviert sind:
   - ✅ `ActiveSelection`
   - ✅ `Selection`
5. Speichern

**Oder führe SQL aus:**
```sql
-- Füge Tabellen zur Realtime publication hinzu
ALTER PUBLICATION supabase_realtime ADD TABLE "ActiveSelection";
ALTER PUBLICATION supabase_realtime ADD TABLE "Selection";

-- Verifizieren
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
```

### Schritt 5: Prüfe Datenbank direkt

Führe in Supabase SQL Editor aus:

```sql
-- Zeige alle aktiven Selections
SELECT * FROM "ActiveSelection"
WHERE "billId" = 'DEINE_BILL_ID_HIER'
ORDER BY "createdAt" DESC;
```

**Wenn leer nach Bob's Klick:**
→ Problem: API speichert nicht in DB
→ Prüfe API-Logs

**Wenn Daten vorhanden:**
→ Problem: Realtime triggert nicht
→ Siehe Schritt 4

### Schritt 6: Test mit DebugRealtimePanel

Füge in `app/split/[token]/page.tsx` am Ende vor `</div>` ein:

```typescript
import DebugRealtimePanel from '@/components/DebugRealtimePanel'

// Am Ende der Page
<DebugRealtimePanel billId={bill.id} />
```

Das Panel zeigt live:
- ✅ Subscription Status
- 📊 Anzahl ActiveSelections
- 📡 Event-Log

## Häufige Probleme

### Problem: "friendName is empty"
**Symptom:** `⚠️ [Live Selection] Skipped - no guest name set`
**Ursache:** Name-Input ist leer oder wurde nicht gespeichert
**Lösung:** Stelle sicher dass Name eingegeben ist

### Problem: "Realtime not triggering"
**Symptom:** Keine `🟢 [Realtime] ActiveSelection change detected` Logs
**Ursache:** Realtime nicht aktiviert in Supabase
**Lösung:** Siehe Schritt 4

### Problem: "Badge not visible despite events"
**Symptom:** Events in Console, aber kein Badge sichtbar
**Ursache:**
1. `currentGuestName` matched `guestName` → Badge wird gefiltert
2. CSS overflow hidden
**Lösung:**
1. Prüfe `🎨 [Badge Render]` Log: `othersSelectingCount` sollte > 0 sein
2. Inspect Element, suche nach `bg-blue-500` div

### Problem: "Multiple tabs same name"
**Symptom:** Eigene Selection wird als "other" angezeigt
**Ursache:** Beide Tabs haben selben Namen
**Lösung:** Verwende unterschiedliche Namen in verschiedenen Tabs

## Erfolgreicher Flow

Bei funktionierendem System siehst du:

**Tab 2 (Bob klickt "1x"):**
```
🔵 [User Action] Item quantity changed
🔵 [Live Selection] Current guest name: Bob
✅ [Live Selection] API success
```

**Tab 1 (Alice):**
```
🟢 [Realtime] ActiveSelection change detected: INSERT
🟢 [Realtime] Received live selections: 1 items
🎨 [Badge Render] othersSelectingCount: 1
```

**Visuell in Tab 1:**
- Badge mit "Bob (1×)" erscheint auf der Position
- Badge hat blauen Hintergrund und pulsierenden Punkt
