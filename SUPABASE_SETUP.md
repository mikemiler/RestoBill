# 🗄️ Supabase Storage Setup

Die App braucht einen **Storage Bucket** für die Rechnungsbilder. Hier ist wie du ihn erstellst:

## Schritt 1: Storage Bucket erstellen

1. Gehe zu deinem Supabase Dashboard:
   [https://supabase.com/dashboard/project/iddnvilcnmaswxrlbhoo/storage/buckets](https://supabase.com/dashboard/project/iddnvilcnmaswxrlbhoo/storage/buckets)

2. Klicke auf **"New bucket"** oder **"Create a new bucket"**

3. Fülle das Formular aus:
   - **Name**: `bill-images`
   - **Public bucket**: ✅ **Aktiviert** (Häkchen setzen!)
   - **File size limit**: `10 MB`
   - **Allowed MIME types**: `image/jpeg, image/png, image/jpg, image/heic`

4. Klicke auf **"Create bucket"**

## Schritt 2: Storage Policies einrichten

Der Bucket braucht **Policies** damit die App Bilder hochladen und lesen kann.

### Option A: Über SQL Editor (Einfachste)

1. Gehe zu: [https://supabase.com/dashboard/project/iddnvilcnmaswxrlbhoo/sql/new](https://supabase.com/dashboard/project/iddnvilcnmaswxrlbhoo/sql/new)

2. Kopiere diesen SQL Code und klicke auf **"Run"**:

```sql
-- Policy 1: Public Read Access (jeder kann Bilder sehen)
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'bill-images');

-- Policy 2: Authenticated Upload (nur mit Service Key hochladen)
CREATE POLICY "Service role upload"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'bill-images');

-- Policy 3: Public Upload (erlaubt auch öffentliche Uploads)
CREATE POLICY "Public upload"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'bill-images');
```

### Option B: Über UI (Alternative)

1. Gehe zu: Storage → Policies → bill-images bucket
2. Klicke auf **"New Policy"**
3. Erstelle 2 Policies:

**Policy 1: Public Read**
- Allowed operation: **SELECT**
- Target roles: **public**
- Policy definition: `bucket_id = 'bill-images'`

**Policy 2: Public Upload**
- Allowed operation: **INSERT**
- Target roles: **public**
- Policy definition: `bucket_id = 'bill-images'`

## Schritt 3: Testen

Nach dem Setup kannst du testen ob alles funktioniert:

1. Starte die App lokal: `npm run dev`
2. Gehe zu: `http://localhost:3000/create`
3. Erstelle eine Testrechnung
4. Lade ein Testbild hoch

Falls es funktioniert, siehst du:
- ✅ Upload erfolgreich
- ✅ Bild wird in Review-Seite angezeigt
- ✅ KI analysiert die Rechnung

## Troubleshooting

### Fehler: "Failed to upload image"

**Lösung:** Prüfe ob der Bucket `bill-images` existiert und **public** ist.

### Fehler: "Policy violation"

**Lösung:** Führe die SQL Policies nochmal aus (Schritt 2, Option A).

### Fehler: "Bucket not found"

**Lösung:**
1. Bucket Name muss **exakt** `bill-images` sein (ohne Leerzeichen!)
2. Prüfe in Storage Dashboard ob Bucket existiert

---

## ✅ Wenn alles funktioniert

Du solltest jetzt:
- ✅ Bucket `bill-images` in Supabase Storage sehen
- ✅ Policies eingerichtet haben
- ✅ Bilder hochladen können

**Nächster Schritt:** Zurück zu README.md → "Development Server starten"
