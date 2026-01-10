-- SQL Script to check and enable Realtime for ActiveSelection and Selection tables
-- Run this in Supabase SQL Editor

-- 1. Check which tables are in the realtime publication
SELECT
  schemaname,
  tablename
FROM
  pg_publication_tables
WHERE
  pubname = 'supabase_realtime';

-- Expected output should include:
-- public | ActiveSelection
-- public | Selection

-- 2. If tables are missing, add them to the publication:
-- (Uncomment and run if needed)

-- ALTER PUBLICATION supabase_realtime ADD TABLE "ActiveSelection";
-- ALTER PUBLICATION supabase_realtime ADD TABLE "Selection";

-- 3. Check RLS policies (if Row Level Security is enabled)
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM
  pg_policies
WHERE
  schemaname = 'public'
  AND tablename IN ('ActiveSelection', 'Selection');

-- 4. If you need to allow SELECT for anonymous users (if RLS is enabled):
-- (Uncomment and run if needed)

-- -- Allow anonymous users to SELECT from ActiveSelection
-- CREATE POLICY "Allow public read access to ActiveSelection"
--   ON "ActiveSelection"
--   FOR SELECT
--   TO anon
--   USING (true);

-- -- Allow anonymous users to SELECT from Selection
-- CREATE POLICY "Allow public read access to Selection"
--   ON "Selection"
--   FOR SELECT
--   TO anon
--   USING (true);

-- 5. Check if Realtime is enabled for the publication
SELECT * FROM pg_publication WHERE pubname = 'supabase_realtime';
