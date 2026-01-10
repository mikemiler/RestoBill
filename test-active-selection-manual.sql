-- Manual test for ActiveSelection Realtime
-- This script manually inserts an ActiveSelection to test if Realtime triggers

-- STEP 1: Find your Bill ID
-- Replace 'YOUR_SHARE_TOKEN' with your actual share token
SELECT id, "payerName", "shareToken"
FROM "Bill"
WHERE "shareToken" = 'YOUR_SHARE_TOKEN';
-- Copy the 'id' from the result

-- STEP 2: Find an Item ID from that Bill
-- Replace 'YOUR_BILL_ID' with the ID from Step 1
SELECT id, name, quantity
FROM "BillItem"
WHERE "billId" = 'YOUR_BILL_ID'
LIMIT 1;
-- Copy the 'id' from the result

-- STEP 3: Insert a test ActiveSelection
-- Replace:
-- - YOUR_BILL_ID with Bill ID from Step 1
-- - YOUR_ITEM_ID with Item ID from Step 2
INSERT INTO "ActiveSelection" (
  id,
  "billId",
  "itemId",
  "guestName",
  quantity,
  "createdAt",
  "expiresAt"
) VALUES (
  gen_random_uuid(),
  'YOUR_BILL_ID',
  'YOUR_ITEM_ID',
  'TestUser',
  1.0,
  NOW(),
  NOW() + INTERVAL '30 minutes'
);

-- STEP 4: Check if Realtime triggered
-- If Realtime is working, you should see in your browser console:
-- 🟢 [Realtime] ActiveSelection change detected: INSERT

-- STEP 5: View all ActiveSelections for your bill
SELECT
  "guestName",
  quantity,
  "createdAt",
  "expiresAt"
FROM "ActiveSelection"
WHERE "billId" = 'YOUR_BILL_ID'
ORDER BY "createdAt" DESC;

-- STEP 6: Clean up test data
DELETE FROM "ActiveSelection"
WHERE "guestName" = 'TestUser';
