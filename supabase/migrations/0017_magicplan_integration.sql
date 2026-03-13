-- 0017: magicplan Integration
-- Tracks magicplan projects linked to RoomLens jobs
-- Stores ESX file URLs once the tech exports from magicplan

CREATE TABLE IF NOT EXISTS magicplan_projects (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id              UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL,
  -- magicplan IDs
  magicplan_project_id TEXT,          -- magicplan's internal project UUID
  external_ref        TEXT,           -- our job_id sent as external_reference_id
  -- status lifecycle: pending → created → scanning → exported → ready
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','created','scanning','exported','ready','error')),
  -- ESX file delivered by magicplan
  esx_file_url        TEXT,           -- public URL of the ESX file stored in Supabase storage
  esx_received_at     TIMESTAMPTZ,
  -- floor plan output
  floor_plan_pdf_url  TEXT,           -- optional: PDF version of the floor plan
  total_area_sqft     NUMERIC,
  room_count          INTEGER,
  rooms_json          JSONB,          -- [{name, area, width, length}]
  -- metadata
  notes               TEXT,
  error_message       TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Only one active magicplan project per job at a time (can have multiple historical)
CREATE INDEX IF NOT EXISTS idx_mp_projects_job_id  ON magicplan_projects(job_id);
CREATE INDEX IF NOT EXISTS idx_mp_projects_user_id ON magicplan_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_mp_projects_ext_ref ON magicplan_projects(external_ref);
CREATE INDEX IF NOT EXISTS idx_mp_projects_mp_id   ON magicplan_projects(magicplan_project_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_magicplan_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_magicplan_updated_at ON magicplan_projects;
CREATE TRIGGER trg_magicplan_updated_at
  BEFORE UPDATE ON magicplan_projects
  FOR EACH ROW EXECUTE FUNCTION update_magicplan_updated_at();

-- RLS
ALTER TABLE magicplan_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mp_owner_all" ON magicplan_projects;
CREATE POLICY "mp_owner_all" ON magicplan_projects
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Webhook inbound: allow service-role inserts (bypasses RLS via service key)
-- No extra policy needed — service key bypasses RLS

SELECT 'magicplan_projects ready' AS status;
