-- ============================================================
-- 0015 · Moisture Map Grid System
-- Supports: Tramex ME5 BLE readings on a floor plan canvas
-- Each job can have multiple map sessions (one per visit day)
-- Each session has a grid of cells (x%, y% of canvas) with MC readings
-- ============================================================

-- Moisture map sessions (one per surface per visit day)
CREATE TABLE IF NOT EXISTS moisture_map_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id         UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL,
  name           TEXT NOT NULL DEFAULT 'Main Floor',
  surface_type   TEXT NOT NULL DEFAULT 'floor'
                 CHECK (surface_type IN ('floor','wall','ceiling')),
  visit_day      INTEGER NOT NULL DEFAULT 1,
  background_url TEXT,           -- Insta360 / floor plan photo
  grid_cols      INTEGER NOT NULL DEFAULT 10,
  grid_rows      INTEGER NOT NULL DEFAULT 8,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Individual grid cell readings
CREATE TABLE IF NOT EXISTS moisture_grid_cells (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID NOT NULL REFERENCES moisture_map_sessions(id) ON DELETE CASCADE,
  col_index      INTEGER NOT NULL,   -- 0-based column
  row_index      INTEGER NOT NULL,   -- 0-based row
  mc_percent     NUMERIC(5,2),       -- moisture content %
  rh_percent     NUMERIC(5,2),       -- relative humidity %
  temp_f         NUMERIC(5,1),       -- temperature °F
  material_type  TEXT NOT NULL DEFAULT 'drywall',
  label          TEXT,               -- optional room label e.g. "Living Room NW"
  photo_url      TEXT,               -- Insta360 X4 photo
  device_id      TEXT,               -- BLE device ID (Tramex ME5)
  recorded_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, col_index, row_index)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mms_job      ON moisture_map_sessions(job_id);
CREATE INDEX IF NOT EXISTS idx_mms_user     ON moisture_map_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_mgc_session  ON moisture_grid_cells(session_id);

-- RLS
ALTER TABLE moisture_map_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE moisture_grid_cells   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_sessions" ON moisture_map_sessions;
CREATE POLICY "users_own_sessions" ON moisture_map_sessions
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users_own_cells" ON moisture_grid_cells;
CREATE POLICY "users_own_cells" ON moisture_grid_cells
  USING (
    session_id IN (
      SELECT id FROM moisture_map_sessions WHERE user_id = auth.uid()
    )
  );

-- Verify
SELECT 'moisture_map_sessions' AS table_name, COUNT(*) FROM moisture_map_sessions
UNION ALL
SELECT 'moisture_grid_cells', COUNT(*) FROM moisture_grid_cells;
