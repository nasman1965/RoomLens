-- ─── MIGRATION 0011: Staff Auth System ───────────────────────────────────────
-- Run in: https://supabase.com/dashboard/project/ilxojqefffravkjxyqlx/sql/new
--
-- What this adds:
--   1. staff_auth_id column on team_members → links to auth.users
--   2. job_assignments table → jobs dispatched to specific staff
--   3. time_clock_entries table → clock in/out per staff per job
--   4. staff_invites table → track pending email invites

-- ── 1. Link team_members to auth.users ───────────────────────────────────────
ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invite_status TEXT DEFAULT 'pending'
    CHECK (invite_status IN ('pending','invited','active','suspended')),
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_team_members_auth_user_id ON team_members(auth_user_id);

-- ── 2. Job Assignments ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  member_id       UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  assigned_by     UUID NOT NULL,                    -- admin user_id
  assigned_at     TIMESTAMPTZ DEFAULT now(),
  status          TEXT NOT NULL DEFAULT 'dispatched'
    CHECK (status IN ('dispatched','accepted','in_progress','completed','declined')),
  dispatch_notes  TEXT,
  accepted_at     TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(job_id, member_id)                         -- one assignment per staff per job
);

CREATE INDEX IF NOT EXISTS idx_job_assignments_job_id    ON job_assignments(job_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_member_id ON job_assignments(member_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_status    ON job_assignments(status);

ALTER TABLE job_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rw_job_assignments" ON job_assignments;
CREATE POLICY "rw_job_assignments" ON job_assignments FOR ALL USING (true);

-- ── 3. Time Clock Entries ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS time_clock_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  member_id       UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  clock_in_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  clock_out_at    TIMESTAMPTZ,
  clock_in_lat    DECIMAL(10,8),
  clock_in_lng    DECIMAL(11,8),
  clock_out_lat   DECIMAL(10,8),
  clock_out_lng   DECIMAL(11,8),
  duration_minutes INT GENERATED ALWAYS AS (
    CASE WHEN clock_out_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (clock_out_at - clock_in_at))::INT / 60
    ELSE NULL END
  ) STORED,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_time_clock_job_id    ON time_clock_entries(job_id);
CREATE INDEX IF NOT EXISTS idx_time_clock_member_id ON time_clock_entries(member_id);
CREATE INDEX IF NOT EXISTS idx_time_clock_date      ON time_clock_entries(clock_in_at);

ALTER TABLE time_clock_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rw_time_clock" ON time_clock_entries;
CREATE POLICY "rw_time_clock" ON time_clock_entries FOR ALL USING (true);

-- ── 4. Staff Invites Tracking ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_invites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  invited_by      UUID NOT NULL,                    -- admin user_id
  email           TEXT NOT NULL,
  invite_token    TEXT UNIQUE,
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','expired')),
  sent_at         TIMESTAMPTZ DEFAULT now(),
  accepted_at     TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days')
);

ALTER TABLE staff_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rw_staff_invites" ON staff_invites;
CREATE POLICY "rw_staff_invites" ON staff_invites FOR ALL USING (true);

-- ── 5. Verify ────────────────────────────────────────────────────────────────
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('job_assignments','time_clock_entries','staff_invites')
ORDER BY table_name;

SELECT column_name FROM information_schema.columns
WHERE table_name = 'team_members'
  AND column_name IN ('auth_user_id','invite_status','invited_at','last_login_at')
ORDER BY column_name;
