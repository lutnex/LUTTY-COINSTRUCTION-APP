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

-- Variation Orders (separate from original estimates — never overwrites issued estimates)
CREATE TABLE IF NOT EXISTS variation_orders (
  id TEXT PRIMARY KEY,
  variation_number TEXT NOT NULL DEFAULT '',
  project_id TEXT DEFAULT '',
  project_name TEXT DEFAULT '',
  client_name TEXT DEFAULT '',
  original_estimate_id TEXT DEFAULT '',
  original_estimate_ref TEXT DEFAULT '',
  original_estimate_total NUMERIC DEFAULT 0,
  revised_total NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'draft',
  vo_date DATE,
  snapshot JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS variation_orders_project_id_idx ON variation_orders (project_id);
CREATE INDEX IF NOT EXISTS variation_orders_updated_at_idx ON variation_orders (updated_at DESC);
CREATE INDEX IF NOT EXISTS variation_orders_original_estimate_idx ON variation_orders (original_estimate_id);

ALTER TABLE variation_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read variation_orders" ON variation_orders;
CREATE POLICY "Allow public read variation_orders" ON variation_orders FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert variation_orders" ON variation_orders;
CREATE POLICY "Allow public insert variation_orders" ON variation_orders FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update variation_orders" ON variation_orders;
CREATE POLICY "Allow public update variation_orders" ON variation_orders FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete variation_orders" ON variation_orders;
CREATE POLICY "Allow public delete variation_orders" ON variation_orders FOR DELETE USING (true);

-- Revised documents (variation revisions — never overwrites issued estimates)
CREATE TABLE IF NOT EXISTS revised_documents (
  id TEXT PRIMARY KEY,
  original_document_id TEXT DEFAULT '',
  project_id TEXT DEFAULT '',
  client_name TEXT DEFAULT '',
  project_title TEXT DEFAULT '',
  revision_number INTEGER NOT NULL DEFAULT 1,
  variation_number TEXT DEFAULT '',
  original_total NUMERIC DEFAULT 0,
  total_additions NUMERIC DEFAULT 0,
  total_omissions NUMERIC DEFAULT 0,
  total_reductions NUMERIC DEFAULT 0,
  total_increases NUMERIC DEFAULT 0,
  net_variation NUMERIC DEFAULT 0,
  revised_total NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'draft',
  document_data JSONB NOT NULL DEFAULT '{}',
  variation_items JSONB NOT NULL DEFAULT '[]',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safe migration from earlier revised_documents schema (re-run in SQL Editor)
ALTER TABLE revised_documents ADD COLUMN IF NOT EXISTS original_document_id TEXT DEFAULT '';
ALTER TABLE revised_documents ADD COLUMN IF NOT EXISTS project_id TEXT DEFAULT '';
ALTER TABLE revised_documents ADD COLUMN IF NOT EXISTS client_name TEXT DEFAULT '';
ALTER TABLE revised_documents ADD COLUMN IF NOT EXISTS project_title TEXT DEFAULT '';
ALTER TABLE revised_documents ADD COLUMN IF NOT EXISTS total_additions NUMERIC DEFAULT 0;
ALTER TABLE revised_documents ADD COLUMN IF NOT EXISTS total_omissions NUMERIC DEFAULT 0;
ALTER TABLE revised_documents ADD COLUMN IF NOT EXISTS total_reductions NUMERIC DEFAULT 0;
ALTER TABLE revised_documents ADD COLUMN IF NOT EXISTS total_increases NUMERIC DEFAULT 0;
ALTER TABLE revised_documents ADD COLUMN IF NOT EXISTS net_variation NUMERIC DEFAULT 0;
ALTER TABLE revised_documents ADD COLUMN IF NOT EXISTS document_data JSONB DEFAULT '{}';
ALTER TABLE revised_documents ADD COLUMN IF NOT EXISTS variation_items JSONB DEFAULT '[]';
ALTER TABLE revised_documents ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'revised_documents' AND column_name = 'parent_document_id'
  ) THEN
    UPDATE revised_documents
    SET original_document_id = COALESCE(NULLIF(original_document_id, ''), parent_document_id)
    WHERE COALESCE(original_document_id, '') = '' AND parent_document_id IS NOT NULL;
    ALTER TABLE revised_documents DROP COLUMN IF EXISTS parent_document_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'revised_documents' AND column_name = 'snapshot'
  ) THEN
    UPDATE revised_documents
    SET document_data = COALESCE(document_data, snapshot)
    WHERE document_data IS NULL OR document_data = '{}'::jsonb;
    ALTER TABLE revised_documents DROP COLUMN IF EXISTS snapshot;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'revised_documents' AND column_name = 'user_notes'
  ) THEN
    UPDATE revised_documents
    SET notes = COALESCE(NULLIF(notes, ''), user_notes)
    WHERE COALESCE(notes, '') = '' AND user_notes IS NOT NULL;
    ALTER TABLE revised_documents DROP COLUMN IF EXISTS user_notes;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'revised_documents' AND column_name = 'variation_order_id'
  ) THEN
    ALTER TABLE revised_documents DROP COLUMN IF EXISTS variation_order_id;
  END IF;
END $$;

ALTER TABLE variation_orders ADD COLUMN IF NOT EXISTS project_title TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS revised_documents_original_doc_idx ON revised_documents (original_document_id);
CREATE INDEX IF NOT EXISTS revised_documents_project_idx ON revised_documents (project_id);
CREATE INDEX IF NOT EXISTS revised_documents_updated_at_idx ON revised_documents (updated_at DESC);

ALTER TABLE revised_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read revised_documents" ON revised_documents;
CREATE POLICY "Allow public read revised_documents" ON revised_documents FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert revised_documents" ON revised_documents;
CREATE POLICY "Allow public insert revised_documents" ON revised_documents FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update revised_documents" ON revised_documents;
CREATE POLICY "Allow public update revised_documents" ON revised_documents FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete revised_documents" ON revised_documents;
CREATE POLICY "Allow public delete revised_documents" ON revised_documents FOR DELETE USING (true);
