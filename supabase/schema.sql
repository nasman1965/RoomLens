-- ============================================================
-- RoomLensPro — Supabase Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── USERS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email             TEXT UNIQUE NOT NULL,
  company_name      TEXT NOT NULL DEFAULT '',
  subscription_tier TEXT NOT NULL DEFAULT 'free'
                    CHECK (subscription_tier IN ('free','starter','pro','enterprise')),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── JOBS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_address TEXT NOT NULL,
  gps_lat          DECIMAL(10,8),
  gps_lng          DECIMAL(11,8),
  job_type         TEXT NOT NULL DEFAULT 'water_loss'
                   CHECK (job_type IN ('water_loss','fire_loss','mold','large_loss','other')),
  status           TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','active','pending','complete')),
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_jobs_user_id ON jobs(user_id);
CREATE INDEX idx_jobs_status  ON jobs(status);
CREATE INDEX idx_jobs_created ON jobs(created_at DESC);

-- ─── ROOMS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id       UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  room_name    TEXT NOT NULL,
  room_type    TEXT,
  floor_number INTEGER NOT NULL DEFAULT 1,
  area_sqft    DECIMAL(10,2),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_rooms_job_id ON rooms(job_id);

-- ─── FLOOR PLAN SCANS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS floor_plan_scans (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id            UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  image_360_url     TEXT,
  floor_plan_svg_url TEXT,
  floor_plan_pdf_url TEXT,
  scale_factor      DECIMAL(10,6),
  room_data_json    JSONB,
  status            TEXT NOT NULL DEFAULT 'uploading'
                    CHECK (status IN ('uploading','processing','complete','error')),
  error_message     TEXT,
  processed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_scans_job_id ON floor_plan_scans(job_id);

-- ─── MOISTURE READINGS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS moisture_readings (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id         UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  room_id        UUID REFERENCES rooms(id) ON DELETE SET NULL,
  x_coord        DECIMAL(5,2) NOT NULL,
  y_coord        DECIMAL(5,2) NOT NULL,
  material_type  TEXT NOT NULL
                 CHECK (material_type IN ('wood','drywall','concrete','subfloor','ceiling')),
  mc_percent     DECIMAL(5,2) NOT NULL,
  rh_percent     DECIMAL(5,2),
  temp_c         DECIMAL(5,2),
  surface_temp   DECIMAL(5,2),
  status         TEXT NOT NULL DEFAULT 'green'
                 CHECK (status IN ('green','yellow','red')),
  reading_date   TIMESTAMPTZ DEFAULT NOW(),
  visit_day      INTEGER NOT NULL DEFAULT 1,
  technician_id  UUID REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_moisture_job_id    ON moisture_readings(job_id);
CREATE INDEX idx_moisture_visit_day ON moisture_readings(visit_day);

-- ─── DRYING VISITS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drying_visits (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id         UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  visit_number   INTEGER NOT NULL,
  visit_date     TIMESTAMPTZ DEFAULT NOW(),
  notes          TEXT,
  technician_id  UUID REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_visits_job_id ON drying_visits(job_id);

-- ─── DAMAGE PHOTOS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS damage_photos (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id            UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  room_id           UUID REFERENCES rooms(id) ON DELETE SET NULL,
  photo_url         TEXT NOT NULL,
  annotated_url     TEXT,
  room_tag          TEXT,
  damage_tag        TEXT CHECK (damage_tag IN ('water','fire','mold','structural','pre_existing')),
  ai_analysis_json  JSONB,
  floor             TEXT,
  area              TEXT,
  gps_lat           DECIMAL(10,8),
  gps_lng           DECIMAL(11,8),
  technician_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  timestamp         TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_photos_job_id  ON damage_photos(job_id);
CREATE INDEX idx_photos_room_id ON damage_photos(room_id);

-- ─── ESTIMATES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS estimates (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id                    UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  ai_draft_json             JSONB,
  xactimate_line_items_json JSONB,
  reviewed_by               UUID REFERENCES users(id) ON DELETE SET NULL,
  status                    TEXT NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft','reviewed','exported')),
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_estimates_job_id ON estimates(job_id);

-- ─── REPORTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id       UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  report_type  TEXT NOT NULL
               CHECK (report_type IN ('full','floor_plan','moisture','photos','estimate')),
  pdf_url      TEXT,
  shared_via   TEXT CHECK (shared_via IN ('email','whatsapp','sms','link')),
  generated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_reports_job_id ON reports(job_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms           ENABLE ROW LEVEL SECURITY;
ALTER TABLE floor_plan_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE moisture_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE drying_visits   ENABLE ROW LEVEL SECURITY;
ALTER TABLE damage_photos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports         ENABLE ROW LEVEL SECURITY;

-- Users can only see their own profile
CREATE POLICY "Users: own profile only"
  ON users FOR ALL USING (auth.uid() = id);

-- Jobs: user owns job
CREATE POLICY "Jobs: owner access"
  ON jobs FOR ALL USING (auth.uid() = user_id);

-- All related tables: access via job ownership
CREATE POLICY "Rooms: via job owner"
  ON rooms FOR ALL
  USING (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

CREATE POLICY "Floor plan scans: via job owner"
  ON floor_plan_scans FOR ALL
  USING (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

CREATE POLICY "Moisture readings: via job owner"
  ON moisture_readings FOR ALL
  USING (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

CREATE POLICY "Drying visits: via job owner"
  ON drying_visits FOR ALL
  USING (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

CREATE POLICY "Damage photos: via job owner"
  ON damage_photos FOR ALL
  USING (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

CREATE POLICY "Estimates: via job owner"
  ON estimates FOR ALL
  USING (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

CREATE POLICY "Reports: via job owner"
  ON reports FOR ALL
  USING (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

-- ============================================================
-- STORAGE BUCKETS (run separately in Supabase Storage)
-- ============================================================
-- Create these buckets in Supabase Dashboard > Storage:
--   photos_360     (private) - 360° source photos
--   floor_plans    (private) - generated SVG/PDF floor plans
--   damage_photos  (private) - damage documentation photos
--   reports        (private) - generated PDF reports
