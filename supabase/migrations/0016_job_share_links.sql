-- 0016: Job Share Links
-- Generates a unique token per job for read-only sharing with adjusters / staff

CREATE TABLE IF NOT EXISTS job_share_links (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id       UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL,
  token        TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'base64url'),
  label        TEXT NOT NULL DEFAULT 'Adjuster Link',
  expires_at   TIMESTAMPTZ,
  access_count INTEGER NOT NULL DEFAULT 0,
  last_accessed TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_share_links_job   ON job_share_links(job_id);
CREATE INDEX IF NOT EXISTS idx_share_links_token ON job_share_links(token);

ALTER TABLE job_share_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_share_links" ON job_share_links;
CREATE POLICY "owner_share_links" ON job_share_links
  USING (user_id = auth.uid());

-- Public read by token (no auth required — for adjuster links)
DROP POLICY IF EXISTS "public_read_by_token" ON job_share_links;
CREATE POLICY "public_read_by_token" ON job_share_links
  FOR SELECT USING (true);

SELECT 'job_share_links ready' AS status;
