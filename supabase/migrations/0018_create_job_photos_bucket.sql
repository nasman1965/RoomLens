-- ============================================================
-- 0018_create_job_photos_bucket.sql
-- Creates the job-photos Supabase Storage bucket + RLS policies
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Create the bucket (public = false → signed URLs required)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-photos',
  'job-photos',
  false,                    -- private: requires signed URL to view
  52428800,                 -- 50 MB per file limit
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/heic','image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. RLS: Authenticated users can upload to their own folder (userId/jobId/...)
DROP POLICY IF EXISTS "job_photos_upload" ON storage.objects;
CREATE POLICY "job_photos_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'job-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3. RLS: Users can read/view their own photos
DROP POLICY IF EXISTS "job_photos_select" ON storage.objects;
CREATE POLICY "job_photos_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'job-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4. RLS: Users can delete their own photos
DROP POLICY IF EXISTS "job_photos_delete" ON storage.objects;
CREATE POLICY "job_photos_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'job-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 5. Verify
SELECT 
  id, 
  name, 
  public, 
  file_size_limit,
  allowed_mime_types,
  created_at
FROM storage.buckets
WHERE id = 'job-photos';
