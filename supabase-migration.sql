-- RestoBill Database Schema for Supabase
-- Run this in Supabase SQL Editor

-- Create bills table
CREATE TABLE IF NOT EXISTS bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  payer_name TEXT NOT NULL,
  paypal_handle TEXT NOT NULL,
  image_url TEXT NOT NULL DEFAULT '',
  restaurant_name TEXT,
  total_amount DECIMAL(10, 2),
  share_token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid()
);

-- Create bill_items table
CREATE TABLE IF NOT EXISTS bill_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price_per_unit DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL
);

-- Create selections table
CREATE TABLE IF NOT EXISTS selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  friend_name TEXT NOT NULL,
  item_quantities JSONB,
  tip_amount DECIMAL(10, 2) DEFAULT 0,
  paid BOOLEAN DEFAULT FALSE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bills_share_token ON bills(share_token);
CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id ON bill_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_selections_bill_id ON selections(bill_id);

-- Enable Row Level Security (RLS)
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE selections ENABLE ROW LEVEL SECURITY;

-- Create policies to allow public access (since this is a public app)
-- You can modify these policies based on your security requirements

-- Bills policies
CREATE POLICY "Allow public read access to bills" ON bills
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access to bills" ON bills
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access to bills" ON bills
  FOR UPDATE USING (true);

-- Bill items policies
CREATE POLICY "Allow public read access to bill_items" ON bill_items
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access to bill_items" ON bill_items
  FOR INSERT WITH CHECK (true);

-- Selections policies
CREATE POLICY "Allow public read access to selections" ON selections
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access to selections" ON selections
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access to selections" ON selections
  FOR UPDATE USING (true);
