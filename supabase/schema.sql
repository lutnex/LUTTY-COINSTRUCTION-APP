-- ConstructIQ saved documents (run in Supabase SQL Editor)
-- Enables cloud persistence across devices and deployments.

CREATE TABLE IF NOT EXISTS saved_documents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  project_name TEXT DEFAULT '',
  category TEXT DEFAULT 'other',
  client_name TEXT DEFAULT '',
  client_contact TEXT DEFAULT '',
  client_email TEXT DEFAULT '',
  project_location TEXT DEFAULT '',
  project_title TEXT DEFAULT '',
  contract_sum NUMERIC DEFAULT 0,
  preview_html TEXT,
  snapshot JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS saved_documents_updated_at_idx
  ON saved_documents (updated_at DESC);

-- Allow anon access (suitable for single-team use; tighten with auth later)
ALTER TABLE saved_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read" ON saved_documents;
CREATE POLICY "Allow public read" ON saved_documents
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert" ON saved_documents;
CREATE POLICY "Allow public insert" ON saved_documents
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update" ON saved_documents;
CREATE POLICY "Allow public update" ON saved_documents
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete" ON saved_documents;
CREATE POLICY "Allow public delete" ON saved_documents
  FOR DELETE USING (true);

-- Material market prices (live search cache + manual overrides)
CREATE TABLE IF NOT EXISTS material_prices (
  id TEXT PRIMARY KEY,
  material_key TEXT UNIQUE NOT NULL,
  material_name TEXT NOT NULL,
  specification TEXT DEFAULT '',
  price NUMERIC,
  unit TEXT DEFAULT '',
  supplier TEXT DEFAULT '',
  supplier_url TEXT DEFAULT '',
  location TEXT DEFAULT 'Ghana',
  source TEXT DEFAULT 'manual',
  status TEXT DEFAULT 'manual_entry_required',
  trend TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS material_prices_checked_at_idx
  ON material_prices (checked_at DESC);

ALTER TABLE material_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read material_prices" ON material_prices;
CREATE POLICY "Allow public read material_prices" ON material_prices
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert material_prices" ON material_prices;
CREATE POLICY "Allow public insert material_prices" ON material_prices
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update material_prices" ON material_prices;
CREATE POLICY "Allow public update material_prices" ON material_prices
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete material_prices" ON material_prices;
CREATE POLICY "Allow public delete material_prices" ON material_prices
  FOR DELETE USING (true);

-- Price profiles (user-agreed rates, labour, equipment, etc.)
CREATE TABLE IF NOT EXISTS price_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS price_profile_items (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES price_profiles(id) ON DELETE CASCADE,
  profile_name TEXT DEFAULT '',
  material_name TEXT NOT NULL,
  specification TEXT DEFAULT '',
  unit TEXT DEFAULT '',
  price NUMERIC,
  currency TEXT DEFAULT 'GHS',
  category TEXT DEFAULT 'material',
  supplier TEXT DEFAULT '',
  supplier_url TEXT DEFAULT '',
  location TEXT DEFAULT '',
  source TEXT DEFAULT 'manual',
  notes TEXT DEFAULT '',
  history JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS price_profile_items_profile_id_idx ON price_profile_items (profile_id);
CREATE INDEX IF NOT EXISTS price_profiles_updated_at_idx ON price_profiles (updated_at DESC);

ALTER TABLE price_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_profile_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read price_profiles" ON price_profiles;
CREATE POLICY "Allow public read price_profiles" ON price_profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert price_profiles" ON price_profiles;
CREATE POLICY "Allow public insert price_profiles" ON price_profiles FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update price_profiles" ON price_profiles;
CREATE POLICY "Allow public update price_profiles" ON price_profiles FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete price_profiles" ON price_profiles;
CREATE POLICY "Allow public delete price_profiles" ON price_profiles FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read price_profile_items" ON price_profile_items;
CREATE POLICY "Allow public read price_profile_items" ON price_profile_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert price_profile_items" ON price_profile_items;
CREATE POLICY "Allow public insert price_profile_items" ON price_profile_items FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update price_profile_items" ON price_profile_items;
CREATE POLICY "Allow public update price_profile_items" ON price_profile_items FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete price_profile_items" ON price_profile_items;
CREATE POLICY "Allow public delete price_profile_items" ON price_profile_items FOR DELETE USING (true);
