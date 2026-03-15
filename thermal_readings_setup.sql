-- ============================================================
-- THERMAL READINGS TABLE — RoomLens Pro
-- Run at: https://supabase.com/dashboard/project/ilxojqefffravkjxyqlx/sql/new
-- ============================================================

CREATE TABLE IF NOT EXISTS thermal_readings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  technician_id     UUID,

  -- Location context
  room_name         TEXT NOT NULL,              -- e.g. "Basement North Wall"
  wall_direction    TEXT,                        -- N / S / E / W / ceiling / floor
  location_notes    TEXT,                        -- e.g. "behind baseboard, left corner"

  -- Temperature data
  surface_temp_c    NUMERIC(5,2),               -- surface reading in Celsius
  ambient_temp_c    NUMERIC(5,2),               -- ambient air temp in Celsius
  temp_delta_c      NUMERIC(5,2)                -- surface - ambient differential
    GENERATED ALWAYS AS (surface_temp_c - ambient_temp_c) STORED,

  -- AI interpretation
  anomaly_type      TEXT,                        -- wet_insulation | mould_heat | normal | cold_bridge | subfloor_wet | bottom_plate
  moisture_probability INTEGER,                  -- 0-100 (AI confidence %)
  mould_risk        TEXT DEFAULT 'low',          -- low | medium | high | critical
  recommendation    TEXT,                        -- one-line action note

  -- Affected area
  affected_area_sf  NUMERIC(8,2),               -- estimated SF of affected zone
  height_from_floor_cm INTEGER,                 -- how high anomaly starts (cm from floor)
  anomaly_height_cm INTEGER,                    -- vertical extent of anomaly (cm)

  -- Photo evidence (FLIR side-by-side)
  thermal_photo_url TEXT,                        -- FLIR thermal JPEG URL (Supabase storage)
  visible_photo_url TEXT,                        -- matching visible-light photo URL

  -- Device
  device_model      TEXT DEFAULT 'FLIR One Pro',
  scan_timestamp    TIMESTAMPTZ DEFAULT now(),

  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_thermal_job      ON thermal_readings(job_id);
CREATE INDEX IF NOT EXISTS idx_thermal_mould    ON thermal_readings(mould_risk);
CREATE INDEX IF NOT EXISTS idx_thermal_anomaly  ON thermal_readings(anomaly_type);
CREATE INDEX IF NOT EXISTS idx_thermal_created  ON thermal_readings(created_at DESC);

-- RLS
ALTER TABLE thermal_readings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_thermal" ON thermal_readings;
CREATE POLICY "service_role_all_thermal" ON thermal_readings FOR ALL USING (true);
