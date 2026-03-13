-- ============================================================
-- 0019_photo_source_insta360.sql
-- Adds photo_source, is_360, thumbnail_url, notes columns to job_photos
-- Supports Insta360 X4 workflow and enhanced damage documentation
-- ============================================================

-- Add photo_source column (standard | insta360 | external)
ALTER TABLE job_photos
  ADD COLUMN IF NOT EXISTS photo_source TEXT NOT NULL DEFAULT 'standard'
    CHECK (photo_source IN ('standard', 'insta360', 'external'));

-- Flag for 360-degree photos
ALTER TABLE job_photos
  ADD COLUMN IF NOT EXISTS is_360 BOOLEAN NOT NULL DEFAULT false;

-- Optional thumbnail/preview for 360 photos (flat equirectangular thumbnail)
ALTER TABLE job_photos
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Free-text notes per photo (damage description, observations)
ALTER TABLE job_photos
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Severity level for damage photos
ALTER TABLE job_photos
  ADD COLUMN IF NOT EXISTS damage_severity TEXT
    CHECK (damage_severity IN ('low', 'medium', 'high', 'critical'));

-- Create index on photo_source for filtering
CREATE INDEX IF NOT EXISTS idx_job_photos_source ON job_photos(photo_source);
CREATE INDEX IF NOT EXISTS idx_job_photos_severity ON job_photos(damage_severity);

-- Update allowed_mime_types in job-photos bucket to also allow HEIC (already set, just verify)
-- Insta360 exports as JPEG, so no new mime types needed

COMMENT ON COLUMN job_photos.photo_source IS 'Origin: standard phone/camera, insta360 X4 export, or external tool';
COMMENT ON COLUMN job_photos.is_360 IS 'True if this is a 360-degree equirectangular image from Insta360 X4';
COMMENT ON COLUMN job_photos.thumbnail_url IS 'Flat preview thumbnail for 360 photos';
COMMENT ON COLUMN job_photos.notes IS 'Technician notes about this photo (damage description, observations)';
COMMENT ON COLUMN job_photos.damage_severity IS 'Severity level: low, medium, high, critical';
