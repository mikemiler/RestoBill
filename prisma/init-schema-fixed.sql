-- RestoBill Database Schema (Fixed for Supabase Table Editor)
-- This version uses lowercase table names without quotes for better compatibility

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables with quotes if they exist
DROP TABLE IF EXISTS "_BillItemToSelection" CASCADE;
DROP TABLE IF EXISTS "Selection" CASCADE;
DROP TABLE IF EXISTS "BillItem" CASCADE;
DROP TABLE IF EXISTS "Bill" CASCADE;

-- Create Bill table
CREATE TABLE bill (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    payer_name TEXT NOT NULL,
    paypal_handle TEXT NOT NULL,
    image_url TEXT NOT NULL DEFAULT '',
    restaurant_name TEXT,
    total_amount DOUBLE PRECISION,
    share_token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::TEXT
);

CREATE INDEX bill_share_token_idx ON bill(share_token);

-- Create BillItem table
CREATE TABLE bill_item (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    bill_id TEXT NOT NULL,
    name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price_per_unit DOUBLE PRECISION NOT NULL,
    total_price DOUBLE PRECISION NOT NULL,
    FOREIGN KEY (bill_id) REFERENCES bill(id) ON DELETE CASCADE
);

CREATE INDEX bill_item_bill_id_idx ON bill_item(bill_id);

-- Create Selection table
CREATE TABLE selection (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    bill_id TEXT NOT NULL,
    friend_name TEXT NOT NULL,
    item_quantities JSONB,
    tip_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    paid BOOLEAN NOT NULL DEFAULT false,
    paid_at TIMESTAMP(3),
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bill_id) REFERENCES bill(id) ON DELETE CASCADE
);

CREATE INDEX selection_bill_id_idx ON selection(bill_id);

-- Create many-to-many relationship table
CREATE TABLE bill_item_to_selection (
    bill_item_id TEXT NOT NULL,
    selection_id TEXT NOT NULL,
    PRIMARY KEY (bill_item_id, selection_id),
    FOREIGN KEY (bill_item_id) REFERENCES bill_item(id) ON DELETE CASCADE,
    FOREIGN KEY (selection_id) REFERENCES selection(id) ON DELETE CASCADE
);

CREATE INDEX bill_item_to_selection_selection_id_idx ON bill_item_to_selection(selection_id);

-- Verify tables were created
SELECT
    tablename,
    schemaname
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('bill', 'bill_item', 'selection', 'bill_item_to_selection')
ORDER BY tablename;
