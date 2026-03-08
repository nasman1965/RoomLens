-- ─── MIGRATION 0004: Fix documents RLS + Storage policies ────────────────────
-- Problem: "new row violates row-level security policy" when inserting documents.
-- Root cause: The USING clause covers SELECT/UPDATE/DELETE but NOT INSERT.
--             INSERT requires WITH CHECK.
-- Run this in: https://supabase.com/dashboard/project/ilxojqefffravkjxyqlx/sql/new

-- ── Step 1: Fix the documents table RLS ──────────────────────────────────────
DROP POLICY IF EXISTS "documents_via_job"    ON documents;
DROP POLICY IF EXISTS "documents_owner_all"  ON documents;

-- New unified policy: covers SELECT, INSERT, UPDATE, DELETE
CREATE POLICY "documents_owner_all" ON documents
  FOR ALL
  USING      (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()))
  WITH CHECK (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

-- ── Step 2: Fix Storage bucket policies for 'documents' bucket ───────────────
-- Allow authenticated users to upload objects into their own folder (user_id/...)
CREATE POLICY "allow_authenticated_uploads" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow authenticated users to read/download their own files
CREATE POLICY "allow_authenticated_reads" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow authenticated users to update their own files
CREATE POLICY "allow_authenticated_updates" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow authenticated users to delete their own files
CREATE POLICY "allow_authenticated_deletes" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── Step 3: Verify ────────────────────────────────────────────────────────────
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'documents'
ORDER BY policyname;
