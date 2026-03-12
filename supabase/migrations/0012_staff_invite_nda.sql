-- ─── MIGRATION 0012: Staff Invite + NDA System ───────────────────────────────
-- Run in: https://supabase.com/dashboard/project/ilxojqefffravkjxyqlx/sql/new

-- ── 1. Add temp_password + invite_token to team_members ──────────────────────
ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS invite_token    TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS invite_sent_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS nda_accepted    BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS nda_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS nda_signed_name TEXT,
  ADD COLUMN IF NOT EXISTS onboarded_at    TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_team_members_invite_token ON team_members(invite_token);

-- ── 2. NDA Acceptances log ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nda_acceptances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  signed_name     TEXT NOT NULL,
  signed_at       TIMESTAMPTZ DEFAULT now(),
  ip_address      TEXT,
  user_agent      TEXT,
  nda_version     TEXT NOT NULL DEFAULT 'v1.0',
  company_name    TEXT
);

ALTER TABLE nda_acceptances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rw_nda_acceptances" ON nda_acceptances;
CREATE POLICY "rw_nda_acceptances" ON nda_acceptances FOR ALL USING (true);

-- ── 3. Verify ────────────────────────────────────────────────────────────────
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('nda_acceptances')
ORDER BY table_name;

SELECT column_name FROM information_schema.columns
WHERE table_name = 'team_members'
  AND column_name IN ('invite_token','nda_accepted','nda_signed_name','onboarded_at')
ORDER BY column_name;
