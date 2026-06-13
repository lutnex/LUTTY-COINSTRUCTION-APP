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
