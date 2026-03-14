-- ============================================================
-- 0023 · Moisture Maps Storage Bucket
-- Creates the 'moisture-maps' bucket for floor plan / Insta360
-- background photos used in moisture map sessions.
-- ============================================================

-- 1. Create bucket (private, 30 MB limit, images only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'moisture-maps',
  'moisture-maps',
  false,
  31457280,   -- 30 MB
  ARRAY[
    'image/jpeg', 'image/jpg', 'image/png',
    'image/webp', 'image/heic', 'image/heif'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ─── RLS policies ──────────────────────────────────────────
-- Path convention: {userId}/{sessionId}/bg_{timestamp}.{ext}
-- Users can only read/write their own folder.

-- 2. Upload
DROP POLICY IF EXISTS "moisture_maps_upload" ON storage.objects;
CREATE POLICY "moisture_maps_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'moisture-maps'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3. Read (signed URL / public URL of own files)
DROP POLICY IF EXISTS "moisture_maps_read" ON storage.objects;
CREATE POLICY "moisture_maps_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'moisture-maps'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4. Update (replace background photo)
DROP POLICY IF EXISTS "moisture_maps_update" ON storage.objects;
CREATE POLICY "moisture_maps_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'moisture-maps'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 5. Delete
DROP POLICY IF EXISTS "moisture_maps_delete" ON storage.objects;
CREATE POLICY "moisture_maps_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'moisture-maps'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─── Verify ───────────────────────────────────────────────
SELECT id, name, public, file_size_limit
FROM   storage.buckets
WHERE  id = 'moisture-maps';
