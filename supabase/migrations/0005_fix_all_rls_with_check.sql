-- ─── MIGRATION 0005: Fix ALL RLS INSERT policies + Storage upload policies ────
-- Problem: Every "FOR ALL USING (...)" policy blocks INSERT because
--          INSERT requires WITH CHECK, not USING.
-- This fixes every job-linked table AND the storage buckets.
-- Run in: https://supabase.com/dashboard/project/ilxojqefffravkjxyqlx/sql/new

-- ══════════════════════════════════════════════════════════════════════════════
-- PART 1: Fix ALL table RLS policies — drop old, recreate with WITH CHECK
-- ══════════════════════════════════════════════════════════════════════════════

-- Helper expression (used repeatedly):
-- job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid())

-- 1. users
DROP POLICY IF EXISTS "users_own_profile" ON users;
CREATE POLICY "users_own_profile" ON users
  FOR ALL
  USING      (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 2. jobs
DROP POLICY IF EXISTS "jobs_owner_access" ON jobs;
CREATE POLICY "jobs_owner_access" ON jobs
  FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. workflow_steps
DROP POLICY IF EXISTS "workflow_steps_via_job" ON workflow_steps;
CREATE POLICY "workflow_steps_via_job" ON workflow_steps
  FOR ALL
  USING      (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()))
  WITH CHECK (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

-- 4. rooms
DROP POLICY IF EXISTS "rooms_via_job" ON rooms;
CREATE POLICY "rooms_via_job" ON rooms
  FOR ALL
  USING      (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()))
  WITH CHECK (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

-- 5. floor_plans
DROP POLICY IF EXISTS "floor_plans_via_job" ON floor_plans;
CREATE POLICY "floor_plans_via_job" ON floor_plans
  FOR ALL
  USING      (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()))
  WITH CHECK (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

-- 6. floor_plan_scans
DROP POLICY IF EXISTS "floor_plan_scans_via_job" ON floor_plan_scans;
CREATE POLICY "floor_plan_scans_via_job" ON floor_plan_scans
  FOR ALL
  USING      (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()))
  WITH CHECK (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

-- 7. moisture_readings
DROP POLICY IF EXISTS "moisture_readings_via_job" ON moisture_readings;
CREATE POLICY "moisture_readings_via_job" ON moisture_readings
  FOR ALL
  USING      (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()))
  WITH CHECK (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

-- 8. drying_visits
DROP POLICY IF EXISTS "drying_visits_via_job" ON drying_visits;
CREATE POLICY "drying_visits_via_job" ON drying_visits
  FOR ALL
  USING      (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()))
  WITH CHECK (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

-- 9. damage_photos  ← PHOTOS page uses this table
DROP POLICY IF EXISTS "damage_photos_via_job" ON damage_photos;
CREATE POLICY "damage_photos_via_job" ON damage_photos
  FOR ALL
  USING      (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()))
  WITH CHECK (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

-- 10. equipment_placements
DROP POLICY IF EXISTS "equipment_placements_via_job" ON equipment_placements;
CREATE POLICY "equipment_placements_via_job" ON equipment_placements
  FOR ALL
  USING      (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()))
  WITH CHECK (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

-- 11. job_logs
DROP POLICY IF EXISTS "job_logs_via_job" ON job_logs;
CREATE POLICY "job_logs_via_job" ON job_logs
  FOR ALL
  USING      (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()))
  WITH CHECK (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

-- 12. documents  ← WAF upload uses this table
DROP POLICY IF EXISTS "documents_via_job"    ON documents;
DROP POLICY IF EXISTS "documents_owner_all"  ON documents;
CREATE POLICY "documents_via_job" ON documents
  FOR ALL
  USING      (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()))
  WITH CHECK (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

-- 13. estimates
DROP POLICY IF EXISTS "estimates_via_job" ON estimates;
CREATE POLICY "estimates_via_job" ON estimates
  FOR ALL
  USING      (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()))
  WITH CHECK (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

-- 14. reports
DROP POLICY IF EXISTS "reports_via_job" ON reports;
CREATE POLICY "reports_via_job" ON reports
  FOR ALL
  USING      (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()))
  WITH CHECK (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

-- 15. content_inventory
DROP POLICY IF EXISTS "content_inventory_via_job" ON content_inventory;
CREATE POLICY "content_inventory_via_job" ON content_inventory
  FOR ALL
  USING      (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()))
  WITH CHECK (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

-- 16. adjuster_portals
DROP POLICY IF EXISTS "adjuster_portals_via_job" ON adjuster_portals;
CREATE POLICY "adjuster_portals_via_job" ON adjuster_portals
  FOR ALL
  USING      (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()))
  WITH CHECK (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

-- 17. invoices
DROP POLICY IF EXISTS "invoices_via_job" ON invoices;
CREATE POLICY "invoices_via_job" ON invoices
  FOR ALL
  USING      (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()))
  WITH CHECK (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

-- 18. insurer_profiles
DROP POLICY IF EXISTS "insurer_profiles_own" ON insurer_profiles;
CREATE POLICY "insurer_profiles_own" ON insurer_profiles
  FOR ALL
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 19. equipment_inventory
DROP POLICY IF EXISTS "equipment_inventory_own" ON equipment_inventory;
CREATE POLICY "equipment_inventory_own" ON equipment_inventory
  FOR ALL
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 20. notifications
DROP POLICY IF EXISTS "notifications_own" ON notifications;
CREATE POLICY "notifications_own" ON notifications
  FOR ALL
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 21. shutoff_locations
DROP POLICY IF EXISTS "shutoff_locations_own" ON shutoff_locations;
CREATE POLICY "shutoff_locations_own" ON shutoff_locations
  FOR ALL
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 22. team_members (from migration 0003)
DROP POLICY IF EXISTS "team_members_owner" ON team_members;
CREATE POLICY "team_members_owner" ON team_members
  FOR ALL
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ══════════════════════════════════════════════════════════════════════════════
-- PART 2: Storage bucket policies
-- Buckets: 'damage-photos' (photos page) and 'documents' (WAF uploads)
-- ══════════════════════════════════════════════════════════════════════════════

-- Drop any conflicting storage policies first
DROP POLICY IF EXISTS "allow_authenticated_uploads" ON storage.objects;
DROP POLICY IF EXISTS "allow_authenticated_reads"   ON storage.objects;
DROP POLICY IF EXISTS "allow_authenticated_updates" ON storage.objects;
DROP POLICY IF EXISTS "allow_authenticated_deletes" ON storage.objects;

-- damage-photos bucket: authenticated users can manage their own folder
CREATE POLICY "damage_photos_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'damage-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "damage_photos_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'damage-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "damage_photos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'damage-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- documents bucket: authenticated users can manage their own folder
CREATE POLICY "documents_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "documents_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "documents_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- PART 3: Verify
-- ══════════════════════════════════════════════════════════════════════════════
SELECT
  tablename,
  policyname,
  cmd,
  CASE WHEN with_check IS NOT NULL THEN '✅ has WITH CHECK' ELSE '⚠️ no WITH CHECK' END AS insert_ok
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
