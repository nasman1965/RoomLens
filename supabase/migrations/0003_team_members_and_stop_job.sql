-- ─── MIGRATION 0003: Team Members + Job Stop/Override system ────────────────
-- Run this in: https://supabase.com/dashboard/project/ilxojqefffravkjxyqlx/sql/new

-- 1. Team members table (company staff directory — no auth required)
CREATE TABLE IF NOT EXISTS team_members (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- owner/admin
  full_name    TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'tech'
               CHECK (role IN ('admin','office','estimator','lead_tech','tech','subcontractor','other')),
  cell_phone   TEXT,
  email        TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team_members_owner" ON team_members
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 2. Add stop/override columns to jobs
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS stopped         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stop_reason     TEXT
    CHECK (stop_reason IN (
      'estimate_only','client_cancelled','insurance_denied',
      'no_damage_found','duplicate_file','other'
    )),
  ADD COLUMN IF NOT EXISTS stop_notes      TEXT,
  ADD COLUMN IF NOT EXISTS stopped_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stopped_by      TEXT,       -- name snapshot
  ADD COLUMN IF NOT EXISTS override_active BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS override_reason TEXT,
  ADD COLUMN IF NOT EXISTS override_by     TEXT,
  ADD COLUMN IF NOT EXISTS override_at     TIMESTAMPTZ;

-- 3. Add created_by_member_id so we can FK to team_members
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS created_by_member_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dispatched_member_id  UUID REFERENCES team_members(id) ON DELETE SET NULL;

-- 4. Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'jobs'
  AND column_name IN ('stopped','stop_reason','stopped_at','override_active','created_by_member_id','dispatched_member_id')
ORDER BY column_name;

SELECT column_name FROM information_schema.columns
WHERE table_name = 'team_members'
ORDER BY ordinal_position;
