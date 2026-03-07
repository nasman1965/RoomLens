-- ============================================================
-- RoomLensPro — Full Supabase Database Schema (24 tables)
-- Version: 2.0 | March 2026
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ilxojqefffravkjxyqlx/sql/new
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── TABLE 1: USERS (profiles) ───────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email             TEXT UNIQUE NOT NULL,
  full_name         TEXT,
  company_name      TEXT,
  role              TEXT NOT NULL DEFAULT 'admin'
                    CHECK (role IN ('admin','estimator','lead_tech','tech')),
  subscription_tier TEXT NOT NULL DEFAULT 'free'
                    CHECK (subscription_tier IN ('free','starter','pro','enterprise')),
  avatar_url        TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TABLE 2: JOBS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claim_number         TEXT,
  xactanalysis_id      TEXT,
  insured_name         TEXT NOT NULL,
  insured_phone        TEXT,
  insured_email        TEXT,
  property_address     TEXT NOT NULL,
  property_city        TEXT,
  property_postal_code TEXT,
  loss_date            DATE,
  loss_category        INTEGER CHECK (loss_category BETWEEN 1 AND 3),
  loss_class           INTEGER CHECK (loss_class BETWEEN 1 AND 4),
  job_type             TEXT NOT NULL DEFAULT 'water_loss'
                       CHECK (job_type IN ('water_loss','fire_loss','mold','large_loss','other')),
  status               TEXT NOT NULL DEFAULT 'new'
                       CHECK (status IN ('new','dispatched','active','review','closed','draft')),
  current_step         INTEGER NOT NULL DEFAULT 1 CHECK (current_step BETWEEN 1 AND 15),
  insurer_name         TEXT,
  adjuster_name        TEXT,
  adjuster_email       TEXT,
  adjuster_phone       TEXT,
  lead_tech_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  notes                TEXT,
  gps_lat              DECIMAL(10,8),
  gps_lng              DECIMAL(11,8),
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id   ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status    ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created   ON jobs(created_at DESC);

-- ─── TABLE 3: WORKFLOW STEPS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_steps (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id          UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  step_number     INTEGER NOT NULL CHECK (step_number BETWEEN 1 AND 15),
  step_name       TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','in_progress','complete','overridden','skipped')),
  completed_at    TIMESTAMPTZ,
  completed_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  override_reason TEXT,
  overridden_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (job_id, step_number)
);
CREATE INDEX IF NOT EXISTS idx_workflow_job_id ON workflow_steps(job_id);

-- ─── TABLE 4: INSURER PROFILES ────────────────────────────────
CREATE TABLE IF NOT EXISTS insurer_profiles (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  insurer_name                TEXT NOT NULL,
  report_24hr_deadline_hours  INTEGER DEFAULT 24,
  scope_deadline_days         INTEGER DEFAULT 5,
  equipment_max_days          INTEGER DEFAULT 3,
  requires_daily_logs         BOOLEAN DEFAULT TRUE,
  xactanalysis_integration    BOOLEAN DEFAULT FALSE,
  preferred_contact_method    TEXT CHECK (preferred_contact_method IN ('email','phone','portal')),
  adjuster_portal_enabled     BOOLEAN DEFAULT TRUE,
  price_list                  TEXT,
  notes                       TEXT,
  created_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TABLE 5: ROOMS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id       UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  room_name    TEXT NOT NULL,
  room_type    TEXT,
  floor_number INTEGER NOT NULL DEFAULT 1,
  area_sqft    DECIMAL(10,2),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rooms_job_id ON rooms(job_id);

-- ─── TABLE 6: FLOOR PLANS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS floor_plans (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id        UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  source        TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('ai','manual')),
  svg_data      TEXT,
  rooms         JSONB,
  total_area    DECIMAL(10,2),
  scale         DECIMAL(10,6),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_floor_plans_job_id ON floor_plans(job_id);

-- ─── TABLE 7: FLOOR PLAN SCANS (360 camera uploads) ──────────
CREATE TABLE IF NOT EXISTS floor_plan_scans (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id              UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  image_360_url       TEXT,
  floor_plan_svg_url  TEXT,
  floor_plan_pdf_url  TEXT,
  scale_factor        DECIMAL(10,6),
  room_data_json      JSONB,
  status              TEXT NOT NULL DEFAULT 'uploading'
                      CHECK (status IN ('uploading','processing','complete','error')),
  error_message       TEXT,
  processed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scans_job_id ON floor_plan_scans(job_id);

-- ─── TABLE 8: MOISTURE READINGS ──────────────────────────────
CREATE TABLE IF NOT EXISTS moisture_readings (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id         UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  room_id        UUID REFERENCES rooms(id) ON DELETE SET NULL,
  x_coord        DECIMAL(5,2) NOT NULL,
  y_coord        DECIMAL(5,2) NOT NULL,
  material_type  TEXT NOT NULL CHECK (material_type IN ('wood','drywall','concrete','subfloor','ceiling')),
  mc_percent     DECIMAL(5,2) NOT NULL,
  rh_percent     DECIMAL(5,2),
  temp_c         DECIMAL(5,2),
  surface_temp   DECIMAL(5,2),
  status         TEXT NOT NULL DEFAULT 'red' CHECK (status IN ('green','yellow','red')),
  reading_date   TIMESTAMPTZ DEFAULT NOW(),
  visit_day      INTEGER NOT NULL DEFAULT 1,
  ble_connected  BOOLEAN DEFAULT FALSE,
  technician_id  UUID REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_moisture_job_id    ON moisture_readings(job_id);
CREATE INDEX IF NOT EXISTS idx_moisture_visit_day ON moisture_readings(visit_day);

-- ─── TABLE 9: DRYING VISITS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS drying_visits (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id         UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  visit_number   INTEGER NOT NULL,
  visit_date     TIMESTAMPTZ DEFAULT NOW(),
  time_on_site   TIME,
  time_off_site  TIME,
  work_performed JSONB,
  atmospherics   JSONB,
  notes          TEXT,
  approved_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at    TIMESTAMPTZ,
  technician_id  UUID REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_visits_job_id ON drying_visits(job_id);

-- ─── TABLE 10: DAMAGE PHOTOS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS damage_photos (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id           UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  room_id          UUID REFERENCES rooms(id) ON DELETE SET NULL,
  photo_url        TEXT NOT NULL,
  annotated_url    TEXT,
  room_tag         TEXT,
  damage_tag       TEXT CHECK (damage_tag IN ('water','fire','mold','structural','pre_existing','evidence')),
  category         TEXT DEFAULT 'general' CHECK (category IN ('general','evidence','progress','final')),
  ai_analysis_json JSONB,
  is_immutable     BOOLEAN DEFAULT FALSE,
  floor            TEXT,
  area             TEXT,
  gps_lat          DECIMAL(10,8),
  gps_lng          DECIMAL(11,8),
  technician_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  timestamp        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_photos_job_id  ON damage_photos(job_id);
CREATE INDEX IF NOT EXISTS idx_photos_room_id ON damage_photos(room_id);

-- ─── TABLE 11: EQUIPMENT INVENTORY ───────────────────────────
CREATE TABLE IF NOT EXISTS equipment_inventory (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  qr_code               TEXT UNIQUE NOT NULL,
  equipment_type        TEXT NOT NULL,
  make                  TEXT,
  model                 TEXT,
  serial_number         TEXT,
  xact_code             TEXT,
  rental_rate_per_day   DECIMAL(10,2),
  purchase_cost         DECIMAL(10,2),
  status                TEXT NOT NULL DEFAULT 'available'
                        CHECK (status IN ('available','deployed','maintenance','retired')),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_equipment_user_id ON equipment_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_equipment_qr      ON equipment_inventory(qr_code);

-- ─── TABLE 12: EQUIPMENT PLACEMENTS ──────────────────────────
CREATE TABLE IF NOT EXISTS equipment_placements (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id   UUID NOT NULL REFERENCES equipment_inventory(id) ON DELETE CASCADE,
  job_id         UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  room_id        UUID REFERENCES rooms(id) ON DELETE SET NULL,
  placed_at      TIMESTAMPTZ DEFAULT NOW(),
  placed_gps     TEXT,
  placed_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  removed_at     TIMESTAMPTZ,
  removed_gps    TEXT,
  removed_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  total_days     DECIMAL(10,2),
  rental_cost    DECIMAL(10,2)
);
CREATE INDEX IF NOT EXISTS idx_placements_job_id ON equipment_placements(job_id);

-- ─── TABLE 13: JOB LOGS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_logs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id     UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_type   TEXT NOT NULL CHECK (log_type IN ('visit','note','system','override','status_change')),
  visit_date TIMESTAMPTZ,
  content    JSONB,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_logs_job_id ON job_logs(job_id);

-- ─── TABLE 14: DOCUMENTS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id        UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  doc_type      TEXT NOT NULL CHECK (doc_type IN ('waf','coc','report_24hr','final_report','invoice','estimate','other')),
  doc_url       TEXT NOT NULL,
  file_name     TEXT,
  signed_status TEXT NOT NULL DEFAULT 'unsigned' CHECK (signed_status IN ('unsigned','signed','declined')),
  signed_at     TIMESTAMPTZ,
  signed_by     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_documents_job_id ON documents(job_id);

-- ─── TABLE 15: ESTIMATES ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS estimates (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id                      UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  ai_draft_json               JSONB,
  xactimate_line_items_json   JSONB,
  total_amount                DECIMAL(12,2),
  reviewed_by                 UUID REFERENCES users(id) ON DELETE SET NULL,
  status                      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','reviewed','exported','approved')),
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_estimates_job_id ON estimates(job_id);

-- ─── TABLE 16: REPORTS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id        UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  report_type   TEXT NOT NULL CHECK (report_type IN ('full','floor_plan','moisture','photos','estimate','initial_24hr')),
  pdf_url       TEXT,
  shared_via    TEXT CHECK (shared_via IN ('email','whatsapp','sms','link')),
  share_token   TEXT UNIQUE,
  share_expires TIMESTAMPTZ,
  generated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reports_job_id ON reports(job_id);

-- ─── TABLE 17: CONTENT INVENTORY ─────────────────────────────
CREATE TABLE IF NOT EXISTS content_inventory (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id            UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  item_description  TEXT NOT NULL,
  photo_url         TEXT,
  condition         TEXT CHECK (condition IN ('good','damaged','non_salvageable')),
  location_room     TEXT,
  action_taken      TEXT CHECK (action_taken IN ('protect','store','dispose')),
  storage_pod_number TEXT,
  homeowner_consent BOOLEAN DEFAULT FALSE,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_content_job_id ON content_inventory(job_id);

-- ─── TABLE 18: ADJUSTER PORTALS ──────────────────────────────
CREATE TABLE IF NOT EXISTS adjuster_portals (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id        UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  share_token   TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  accessed_at   TIMESTAMPTZ,
  access_count  INTEGER DEFAULT 0,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_portals_job_id ON adjuster_portals(job_id);
CREATE INDEX IF NOT EXISTS idx_portals_token  ON adjuster_portals(share_token);

-- ─── TABLE 19: INVOICES ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id          UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  invoice_type    TEXT NOT NULL CHECK (invoice_type IN ('mitigation','deductible','supplement')),
  invoice_number  TEXT UNIQUE,
  amount          DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_amount      DECIMAL(12,2) DEFAULT 0,
  total_amount    DECIMAL(12,2) DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','overdue','disputed')),
  due_date        DATE,
  paid_at         TIMESTAMPTZ,
  pdf_url         TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invoices_job_id ON invoices(job_id);

-- ─── TABLE 20: NOTIFICATIONS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id       UUID REFERENCES jobs(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  message      TEXT NOT NULL,
  notif_type   TEXT CHECK (notif_type IN ('deadline','equipment_overdue','drying_goal','system','workflow')),
  is_read      BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notif_user_id ON notifications(user_id);

-- ─── TABLE 21: EQUIPMENT QR LABELS ───────────────────────────
CREATE TABLE IF NOT EXISTS equipment_qr_labels (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id   UUID NOT NULL REFERENCES equipment_inventory(id) ON DELETE CASCADE,
  qr_image_url   TEXT,
  label_pdf_url  TEXT,
  printed_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TABLE 22: SHUTOFFMAP LOCATIONS ──────────────────────────
CREATE TABLE IF NOT EXISTS shutoff_locations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_name   TEXT NOT NULL,
  property_address TEXT,
  valve_type      TEXT CHECK (valve_type IN ('main','unit','zone','gas','electric')),
  location_notes  TEXT,
  photo_url       TEXT,
  floor_plan_url  TEXT,
  gps_lat         DECIMAL(10,8),
  gps_lng         DECIMAL(11,8),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TABLE 23: MATERIAL DRY STANDARDS ────────────────────────
CREATE TABLE IF NOT EXISTS material_dry_standards (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_type   TEXT UNIQUE NOT NULL,
  wet_threshold   DECIMAL(5,2) NOT NULL,
  dry_threshold   DECIMAL(5,2) NOT NULL,
  iicrc_class     TEXT,
  notes           TEXT
);

-- Pre-populate IICRC dry standards
INSERT INTO material_dry_standards (material_type, wet_threshold, dry_threshold, iicrc_class) VALUES
  ('wood',      20.0, 15.0, 'Class 2'),
  ('drywall',   17.0, 12.0, 'Class 2'),
  ('concrete',  6.0,  4.0,  'Class 1'),
  ('subfloor',  19.0, 15.0, 'Class 2'),
  ('ceiling',   17.0, 12.0, 'Class 2')
ON CONFLICT (material_type) DO NOTHING;

-- ─── TABLE 24: AUDIT LOG ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  job_id      UUID REFERENCES jobs(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  table_name  TEXT,
  record_id   UUID,
  old_values  JSONB,
  new_values  JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_job_id  ON audit_log(job_id);

-- ============================================================
-- TRIGGERS: Auto-update updated_at timestamps
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_steps_updated_at
  BEFORE UPDATE ON workflow_steps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_estimates_updated_at
  BEFORE UPDATE ON estimates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_steps      ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurer_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms               ENABLE ROW LEVEL SECURITY;
ALTER TABLE floor_plans         ENABLE ROW LEVEL SECURITY;
ALTER TABLE floor_plan_scans    ENABLE ROW LEVEL SECURITY;
ALTER TABLE moisture_readings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE drying_visits       ENABLE ROW LEVEL SECURITY;
ALTER TABLE damage_photos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents           ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates           ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports             ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_inventory   ENABLE ROW LEVEL SECURITY;
ALTER TABLE adjuster_portals    ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices            ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE shutoff_locations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log           ENABLE ROW LEVEL SECURITY;

-- ─── RLS Policies ────────────────────────────────────────────

-- Users: own profile only
CREATE POLICY "users_own_profile" ON users
  FOR ALL USING (auth.uid() = id);

-- Jobs: user owns job
CREATE POLICY "jobs_owner_access" ON jobs
  FOR ALL USING (auth.uid() = user_id);

-- All job-related tables: access via job ownership
CREATE POLICY "workflow_steps_via_job" ON workflow_steps
  FOR ALL USING (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

CREATE POLICY "rooms_via_job" ON rooms
  FOR ALL USING (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

CREATE POLICY "floor_plans_via_job" ON floor_plans
  FOR ALL USING (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

CREATE POLICY "floor_plan_scans_via_job" ON floor_plan_scans
  FOR ALL USING (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

CREATE POLICY "moisture_readings_via_job" ON moisture_readings
  FOR ALL USING (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

CREATE POLICY "drying_visits_via_job" ON drying_visits
  FOR ALL USING (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

CREATE POLICY "damage_photos_via_job" ON damage_photos
  FOR ALL USING (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

CREATE POLICY "equipment_placements_via_job" ON equipment_placements
  FOR ALL USING (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

CREATE POLICY "job_logs_via_job" ON job_logs
  FOR ALL USING (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

CREATE POLICY "documents_via_job" ON documents
  FOR ALL USING (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

CREATE POLICY "estimates_via_job" ON estimates
  FOR ALL USING (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

CREATE POLICY "reports_via_job" ON reports
  FOR ALL USING (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

CREATE POLICY "content_inventory_via_job" ON content_inventory
  FOR ALL USING (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

CREATE POLICY "adjuster_portals_via_job" ON adjuster_portals
  FOR ALL USING (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

CREATE POLICY "invoices_via_job" ON invoices
  FOR ALL USING (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

-- User-owned tables
CREATE POLICY "insurer_profiles_own" ON insurer_profiles
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "equipment_inventory_own" ON equipment_inventory
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "notifications_own" ON notifications
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "shutoff_locations_own" ON shutoff_locations
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "audit_log_own" ON audit_log
  FOR SELECT USING (user_id = auth.uid());

-- ============================================================
-- STORAGE BUCKETS
-- Run in Supabase Dashboard > Storage, or via API:
-- Create these 6 buckets (all private):
--   1. floor-plan-scans     (private, 50MB max)
--   2. damage-photos        (private, 20MB max)
--   3. documents            (private, 10MB max)
--   4. equipment-qr-labels  (private, 5MB max)
--   5. reports              (private, 50MB max)
--   6. company-assets       (private, 5MB max)
-- ============================================================

-- ============================================================
-- COMPLETE! 24 tables created:
-- 1.  users
-- 2.  jobs
-- 3.  workflow_steps
-- 4.  insurer_profiles
-- 5.  rooms
-- 6.  floor_plans
-- 7.  floor_plan_scans
-- 8.  moisture_readings
-- 9.  drying_visits
-- 10. damage_photos
-- 11. equipment_inventory
-- 12. equipment_placements
-- 13. job_logs
-- 14. documents
-- 15. estimates
-- 16. reports
-- 17. content_inventory
-- 18. adjuster_portals
-- 19. invoices
-- 20. notifications
-- 21. equipment_qr_labels
-- 22. shutoff_locations
-- 23. material_dry_standards
-- 24. audit_log
-- ============================================================
