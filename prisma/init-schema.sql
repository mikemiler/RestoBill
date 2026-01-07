-- RestoBill Database Schema
-- This SQL script creates all necessary tables for the RestoBill application
-- Run this in your Supabase SQL Editor if the schema hasn't been automatically pushed

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: Bill
-- Stores information about bills/receipts created by users
CREATE TABLE IF NOT EXISTS "Bill" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payerName" TEXT NOT NULL,
    "paypalHandle" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "restaurantName" TEXT,
    "totalAmount" DOUBLE PRECISION,
    "shareToken" TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::TEXT
);

-- Index on shareToken for fast lookups
CREATE INDEX IF NOT EXISTS "Bill_shareToken_idx" ON "Bill"("shareToken");

-- Table: BillItem
-- Stores individual items from a bill
CREATE TABLE IF NOT EXISTS "BillItem" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    "billId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "pricePerUnit" DOUBLE PRECISION NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "BillItem_billId_fkey" FOREIGN KEY ("billId")
        REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Index on billId for fast lookups
CREATE INDEX IF NOT EXISTS "BillItem_billId_idx" ON "BillItem"("billId");

-- Table: Selection
-- Stores user selections of items they want to pay for
CREATE TABLE IF NOT EXISTS "Selection" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    "billId" TEXT NOT NULL,
    "friendName" TEXT NOT NULL,
    "itemQuantities" JSONB,
    "tipAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Selection_billId_fkey" FOREIGN KEY ("billId")
        REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Index on billId for fast lookups
CREATE INDEX IF NOT EXISTS "Selection_billId_idx" ON "Selection"("billId");

-- Table: _BillItemToSelection (Many-to-Many relationship table)
-- Links BillItems to Selections
CREATE TABLE IF NOT EXISTS "_BillItemToSelection" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_BillItemToSelection_A_fkey" FOREIGN KEY ("A")
        REFERENCES "BillItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_BillItemToSelection_B_fkey" FOREIGN KEY ("B")
        REFERENCES "Selection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Unique index to prevent duplicate relationships
CREATE UNIQUE INDEX IF NOT EXISTS "_BillItemToSelection_AB_unique" ON "_BillItemToSelection"("A", "B");

-- Index for reverse lookups
CREATE INDEX IF NOT EXISTS "_BillItemToSelection_B_idx" ON "_BillItemToSelection"("B");

-- Verify tables were created
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('Bill', 'BillItem', 'Selection', '_BillItemToSelection')
    ) THEN
        RAISE NOTICE '✅ Tables created successfully!';
    END IF;
END $$;
