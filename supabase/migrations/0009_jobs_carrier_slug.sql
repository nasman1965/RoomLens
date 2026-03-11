-- ============================================================
-- RoomLens Pro: Add carrier_slug to jobs table
-- Migration: 0009_jobs_carrier_slug
-- Run in Supabase SQL Editor
-- ============================================================

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS carrier_slug TEXT;

CREATE INDEX IF NOT EXISTS idx_jobs_carrier_slug ON jobs(carrier_slug);

-- Verify
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'jobs' AND column_name = 'carrier_slug';
