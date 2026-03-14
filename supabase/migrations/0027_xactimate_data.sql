-- ============================================================
-- Migration 0027: xactimate_data table
-- Stores per-job Xactimate / XactAnalysis tracking data
-- Run via: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── Create table ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS xactimate_data (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id                  UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id                 UUID NOT NULL,

  -- Claim / file reference numbers
  xact_claim_number       TEXT NOT NULL DEFAULT '',
  xact_file_number        TEXT NOT NULL DEFAULT '',
  xact_policy_number      TEXT NOT NULL DEFAULT '',

  -- Adjuster / IA information
  adjuster_company        TEXT NOT NULL DEFAULT '',
  adjuster_name           TEXT NOT NULL DEFAULT '',
  adjuster_email          TEXT NOT NULL DEFAULT '',
  adjuster_phone          TEXT NOT NULL DEFAULT '',

  -- Estimate status
  estimate_status         TEXT NOT NULL DEFAULT 'not_started'
                            CHECK (estimate_status IN (
                              'not_started','in_progress','submitted',
                              'approved','supplement','closed'
                            )),

  -- Financial totals (stored as text to preserve formatting)
  rcv_total               TEXT NOT NULL DEFAULT '',
  acv_total               TEXT NOT NULL DEFAULT '',
  depreciation            TEXT NOT NULL DEFAULT '',
  deductible              TEXT NOT NULL DEFAULT '',
  overhead_profit         TEXT NOT NULL DEFAULT '',

  -- Scope and line items
  scope_notes             TEXT NOT NULL DEFAULT '',
  scope_notes_json        TEXT NOT NULL DEFAULT '[]',  -- JSON array of line items

  -- ESX file export tracking
  esx_file_name           TEXT NOT NULL DEFAULT '',
  esx_exported_at         TIMESTAMPTZ,
  esx_imported_to_xact    BOOLEAN NOT NULL DEFAULT FALSE,

  -- XactAnalysis carrier portal
  xactanalysis_job_id     TEXT NOT NULL DEFAULT '',
  xactanalysis_status     TEXT NOT NULL DEFAULT '',
  xactanalysis_last_sync  DATE,

  -- Supplement tracking
  supplement_number       TEXT NOT NULL DEFAULT '',
  supplement_reason       TEXT NOT NULL DEFAULT '',

  -- Timestamps
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Unique constraint: one record per job ─────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS xactimate_data_job_id_key ON xactimate_data(job_id);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS xactimate_data_user_id_idx   ON xactimate_data(user_id);
CREATE INDEX IF NOT EXISTS xactimate_data_job_id_idx    ON xactimate_data(job_id);
CREATE INDEX IF NOT EXISTS xactimate_data_status_idx    ON xactimate_data(estimate_status);

-- ── Updated-at trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_xactimate_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS xactimate_data_updated_at_trigger ON xactimate_data;
CREATE TRIGGER xactimate_data_updated_at_trigger
  BEFORE UPDATE ON xactimate_data
  FOR EACH ROW EXECUTE FUNCTION update_xactimate_data_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE xactimate_data ENABLE ROW LEVEL SECURITY;

-- Users can SELECT their own company's data
CREATE POLICY xactimate_data_select ON xactimate_data
  FOR SELECT TO authenticated
  USING (user_id = get_company_owner_id());

-- Users can INSERT their own data
CREATE POLICY xactimate_data_insert ON xactimate_data
  FOR INSERT TO authenticated
  WITH CHECK (user_id = get_company_owner_id());

-- Users can UPDATE their own data
CREATE POLICY xactimate_data_update ON xactimate_data
  FOR UPDATE TO authenticated
  USING (user_id = get_company_owner_id());

-- Users can DELETE their own data
CREATE POLICY xactimate_data_delete ON xactimate_data
  FOR DELETE TO authenticated
  USING (user_id = get_company_owner_id());

-- ── Verify ────────────────────────────────────────────────────────────────────
SELECT 
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'xactimate_data'
ORDER BY ordinal_position;

SELECT policyname, cmd FROM pg_policies WHERE tablename = 'xactimate_data' ORDER BY policyname;
