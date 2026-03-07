-- ─── MIGRATION: Add workflow step data columns ───────────────────────────────
-- Run this in: https://supabase.com/dashboard/project/ilxojqefffravkjxyqlx/sql/new

-- 1. Add lead_source and file creation metadata to jobs
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS lead_source        TEXT DEFAULT 'manual'
                                              CHECK (lead_source IN ('manual','phone','ppc_ad','xactanalysis','referral','repeat_client','other')),
  ADD COLUMN IF NOT EXISTS lead_source_detail TEXT,          -- e.g. "Google Ad - Water Damage Ottawa"
  ADD COLUMN IF NOT EXISTS created_by_name    TEXT,          -- snapshot of who created the file
  ADD COLUMN IF NOT EXISTS created_by_phone   TEXT,
  ADD COLUMN IF NOT EXISTS created_by_email   TEXT;

-- 2. Add dispatch fields
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS dispatched_to_name  TEXT,         -- technician dispatched to
  ADD COLUMN IF NOT EXISTS dispatched_to_phone TEXT,
  ADD COLUMN IF NOT EXISTS dispatched_to_email TEXT,
  ADD COLUMN IF NOT EXISTS dispatched_at        TIMESTAMPTZ, -- when dispatched
  ADD COLUMN IF NOT EXISTS dispatch_notes       TEXT,
  ADD COLUMN IF NOT EXISTS eta_minutes          INTEGER;     -- ETA in minutes

-- 3. Add work authorization fields
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS work_auth_status    TEXT DEFAULT 'pending'
                                               CHECK (work_auth_status IN ('pending','sent','viewed','signed','declined')),
  ADD COLUMN IF NOT EXISTS work_auth_sent_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS work_auth_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS work_auth_signed_by TEXT,         -- name of signer
  ADD COLUMN IF NOT EXISTS work_auth_doc_url   TEXT;         -- URL to signed WAF document

-- 4. Verify columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'jobs'
  AND column_name IN (
    'lead_source','lead_source_detail','created_by_name','created_by_phone',
    'dispatched_to_name','dispatched_to_phone','dispatched_at',
    'work_auth_status','work_auth_sent_at','work_auth_signed_at','work_auth_doc_url'
  )
ORDER BY column_name;
