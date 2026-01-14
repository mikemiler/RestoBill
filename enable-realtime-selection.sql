-- Enable Realtime Replication for Selection table
-- This allows the Selection table to emit postgres_changes events via Supabase Realtime

-- ===== 1. Verify Publication (already done) =====
-- The Selection table is already in the publication, so we skip this step
-- ALTER PUBLICATION supabase_realtime ADD TABLE "Selection";

-- ===== 2. Grant SELECT permission to anon role =====
-- Required for Supabase Realtime to allow anonymous users to subscribe
GRANT SELECT ON TABLE "Selection" TO anon;
GRANT SELECT ON TABLE "Selection" TO authenticated;

-- ===== 3. Grant SELECT permission for related tables =====
GRANT SELECT ON TABLE "Bill" TO anon;
GRANT SELECT ON TABLE "BillItem" TO anon;
GRANT SELECT ON TABLE "ActiveSelection" TO anon;

GRANT SELECT ON TABLE "Bill" TO authenticated;
GRANT SELECT ON TABLE "BillItem" TO authenticated;
GRANT SELECT ON TABLE "ActiveSelection" TO authenticated;

-- ===== 4. Enable RLS (Row Level Security) if not already enabled =====
ALTER TABLE "Selection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Bill" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BillItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ActiveSelection" ENABLE ROW LEVEL SECURITY;

-- ===== 5. Create RLS Policies for Selection =====
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access to Selection" ON "Selection";

-- Allow anyone to read selections (public bills)
CREATE POLICY "Allow public read access to Selection"
ON "Selection"
FOR SELECT
TO anon, authenticated
USING (true);

-- ===== 6. Create RLS Policies for related tables =====
-- Bill table
DROP POLICY IF EXISTS "Allow public read access to Bill" ON "Bill";
CREATE POLICY "Allow public read access to Bill"
ON "Bill"
FOR SELECT
TO anon, authenticated
USING (true);

-- BillItem table
DROP POLICY IF EXISTS "Allow public read access to BillItem" ON "BillItem";
CREATE POLICY "Allow public read access to BillItem"
ON "BillItem"
FOR SELECT
TO anon, authenticated
USING (true);

-- ActiveSelection table
DROP POLICY IF EXISTS "Allow public read access to ActiveSelection" ON "ActiveSelection";
CREATE POLICY "Allow public read access to ActiveSelection"
ON "ActiveSelection"
FOR SELECT
TO anon, authenticated
USING (true);

-- ===== 7. Verify setup =====
-- Check publication membership
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';

-- Check grants
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'Selection';
