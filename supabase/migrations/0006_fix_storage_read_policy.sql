-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 0006: Fix storage bucket read policies for damage-photos & documents
-- Run this in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

-- Drop ALL existing storage policies to start fresh
DROP POLICY IF EXISTS "damage_photos_upload"  ON storage.objects;
DROP POLICY IF EXISTS "damage_photos_read"    ON storage.objects;
DROP POLICY IF EXISTS "damage_photos_delete"  ON storage.objects;
DROP POLICY IF EXISTS "documents_upload"      ON storage.objects;
DROP POLICY IF EXISTS "documents_read"        ON storage.objects;
DROP POLICY IF EXISTS "documents_delete"      ON storage.objects;
DROP POLICY IF EXISTS "allow_authenticated_uploads" ON storage.objects;
DROP POLICY IF EXISTS "allow_authenticated_reads"   ON storage.objects;
DROP POLICY IF EXISTS "allow_authenticated_updates" ON storage.objects;
DROP POLICY IF EXISTS "allow_authenticated_deletes" ON storage.objects;

-- ── damage-photos bucket ─────────────────────────────────────────────────────
-- Allow authenticated users to UPLOAD to their own folder (userId/jobId/file)
CREATE POLICY "damage_photos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'damage-photos');

-- Allow authenticated users to READ any file in the bucket (for signed URLs to work)
CREATE POLICY "damage_photos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'damage-photos');

-- Allow authenticated users to DELETE their own photos
CREATE POLICY "damage_photos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'damage-photos');

-- ── documents bucket ─────────────────────────────────────────────────────────
-- Allow authenticated users to UPLOAD to documents bucket
CREATE POLICY "documents_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents');

-- Allow authenticated users to READ from documents bucket
CREATE POLICY "documents_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents');

-- Allow authenticated users to DELETE from documents bucket
CREATE POLICY "documents_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documents');

-- ── Verification ─────────────────────────────────────────────────────────────
SELECT
  policyname,
  cmd,
  CASE WHEN with_check IS NOT NULL THEN '✅ WITH CHECK' ELSE '—' END as check_status
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;
