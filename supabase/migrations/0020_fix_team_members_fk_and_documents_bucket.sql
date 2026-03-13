-- ============================================================
-- 0020_fix_team_members_fk_and_documents_bucket.sql
--
-- FIXES TWO BUGS:
--   1. FK violation when adding employees:
--      team_members.user_id → users(id) fails when auth user
--      has no row in public.users yet. Fix: auto-create user
--      row on first login via trigger, AND backfill any missing rows.
--
--   2. "Bucket not found" for WAF documents:
--      The 'documents' storage bucket was never created.
--      Create it now with proper RLS policies.
--
-- Run in: Supabase Dashboard → SQL Editor
--         https://supabase.com/dashboard/project/ilxojqefffravkjxyqlx/sql/new
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- PART 1: FIX team_members FK (users table auto-sync)
-- ════════════════════════════════════════════════════════════

-- 1a. Ensure public.users table exists (safe if already exists)
CREATE TABLE IF NOT EXISTS public.users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT,
  full_name       TEXT,
  company_name    TEXT DEFAULT 'My Company',
  phone           TEXT,
  role            TEXT DEFAULT 'company_admin',
  plan            TEXT DEFAULT 'starter',
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Allow users to read/update their own row
DROP POLICY IF EXISTS "users_self_rw" ON public.users;
CREATE POLICY "users_self_rw" ON public.users
  FOR ALL USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 1b. Function: auto-create public.users row when auth user signs in/up
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO UPDATE SET
    email     = EXCLUDED.email,
    updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 1c. Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 1d. Backfill: insert a public.users row for every existing auth user
--     that is currently missing one (safe to run multiple times)
INSERT INTO public.users (id, email, full_name)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1))
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 1e. Verify backfill worked
SELECT
  'auth.users count'   AS label, COUNT(*) AS n FROM auth.users
UNION ALL
SELECT
  'public.users count' AS label, COUNT(*) AS n FROM public.users;

-- ════════════════════════════════════════════════════════════
-- PART 2: CREATE 'documents' storage bucket
-- ════════════════════════════════════════════════════════════

-- 2a. Create the bucket (private – signed URLs required)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,            -- private
  52428800,         -- 50 MB per file
  ARRAY[
    'application/pdf',
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2b. RLS: authenticated users can upload to their own folder
DROP POLICY IF EXISTS "documents_upload" ON storage.objects;
CREATE POLICY "documents_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 2c. RLS: authenticated users can read their own documents
DROP POLICY IF EXISTS "documents_select" ON storage.objects;
CREATE POLICY "documents_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 2d. RLS: authenticated users can delete their own documents
DROP POLICY IF EXISTS "documents_delete" ON storage.objects;
CREATE POLICY "documents_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 2e. RLS: allow updates (needed for some Supabase storage operations)
DROP POLICY IF EXISTS "documents_update" ON storage.objects;
CREATE POLICY "documents_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 2f. Verify bucket exists
SELECT
  id, name, public, file_size_limit, allowed_mime_types, created_at
FROM storage.buckets
WHERE id IN ('documents', 'job-photos')
ORDER BY id;

-- ════════════════════════════════════════════════════════════
-- PART 3: OPTIONAL - also fix job-photos bucket allowed types
-- (ensures HEIC/HEIF are accepted for Insta360 exports)
-- ════════════════════════════════════════════════════════════
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'image/heic', 'image/heif'
]
WHERE id = 'job-photos';
