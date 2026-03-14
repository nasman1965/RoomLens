-- ============================================================
-- 0021_create_job_photos_table.sql
-- Creates the job_photos table (was missing — only bucket existed)
-- Run this in: Supabase Dashboard → SQL Editor
-- Project: https://supabase.com/dashboard/project/ilxojqefffravkjxyqlx/sql/new
-- ============================================================

-- ── 1. Create job_photos table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.job_photos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id           UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  photo_url        TEXT NOT NULL,
  room_tag         TEXT,
  damage_tag       TEXT CHECK (damage_tag IN (
                     'pre_existing','water_damage','mold',
                     'structural','equipment','after'
                   )),
  area             TEXT,
  technician_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  timestamp        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Insta360 X4 / photo source fields (from migration 0019)
  photo_source     TEXT NOT NULL DEFAULT 'standard'
                     CHECK (photo_source IN ('standard','insta360','external')),
  is_360           BOOLEAN NOT NULL DEFAULT false,
  thumbnail_url    TEXT,
  notes            TEXT,
  damage_severity  TEXT CHECK (damage_severity IN ('low','medium','high','critical')),

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. Indexes for fast filtering ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_job_photos_job_id       ON public.job_photos(job_id);
CREATE INDEX IF NOT EXISTS idx_job_photos_technician   ON public.job_photos(technician_id);
CREATE INDEX IF NOT EXISTS idx_job_photos_damage_tag   ON public.job_photos(damage_tag);
CREATE INDEX IF NOT EXISTS idx_job_photos_room_tag     ON public.job_photos(room_tag);
CREATE INDEX IF NOT EXISTS idx_job_photos_source       ON public.job_photos(photo_source);
CREATE INDEX IF NOT EXISTS idx_job_photos_severity     ON public.job_photos(damage_severity);
CREATE INDEX IF NOT EXISTS idx_job_photos_timestamp    ON public.job_photos(timestamp DESC);

-- ── 3. Enable Row Level Security ─────────────────────────────────────────────
ALTER TABLE public.job_photos ENABLE ROW LEVEL SECURITY;

-- ── 4. RLS Policies ──────────────────────────────────────────────────────────

-- Allow authenticated users to SELECT photos for jobs they own
DROP POLICY IF EXISTS "job_photos_select" ON public.job_photos;
CREATE POLICY "job_photos_select"
  ON public.job_photos FOR SELECT
  TO authenticated
  USING (
    technician_id = auth.uid()
    OR
    job_id IN (
      SELECT id FROM public.jobs WHERE user_id = auth.uid()
    )
  );

-- Allow authenticated users to INSERT photos
DROP POLICY IF EXISTS "job_photos_insert" ON public.job_photos;
CREATE POLICY "job_photos_insert"
  ON public.job_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    technician_id = auth.uid()
    OR
    job_id IN (
      SELECT id FROM public.jobs WHERE user_id = auth.uid()
    )
  );

-- Allow photo owner or job owner to UPDATE tags/notes
DROP POLICY IF EXISTS "job_photos_update" ON public.job_photos;
CREATE POLICY "job_photos_update"
  ON public.job_photos FOR UPDATE
  TO authenticated
  USING (
    technician_id = auth.uid()
    OR
    job_id IN (
      SELECT id FROM public.jobs WHERE user_id = auth.uid()
    )
  );

-- Allow photo owner or job owner to DELETE
DROP POLICY IF EXISTS "job_photos_delete" ON public.job_photos;
CREATE POLICY "job_photos_delete"
  ON public.job_photos FOR DELETE
  TO authenticated
  USING (
    technician_id = auth.uid()
    OR
    job_id IN (
      SELECT id FROM public.jobs WHERE user_id = auth.uid()
    )
  );

-- ── 5. Column comments ───────────────────────────────────────────────────────
COMMENT ON TABLE  public.job_photos              IS 'Photos attached to restoration jobs';
COMMENT ON COLUMN public.job_photos.photo_source IS 'standard | insta360 | external';
COMMENT ON COLUMN public.job_photos.is_360       IS 'True = equirectangular 360° JPEG from Insta360 X4';
COMMENT ON COLUMN public.job_photos.damage_tag   IS 'Type of damage documented in this photo';
COMMENT ON COLUMN public.job_photos.damage_severity IS 'low | medium | high | critical';

-- ── 6. Verify ────────────────────────────────────────────────────────────────
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'job_photos'
ORDER BY ordinal_position;
