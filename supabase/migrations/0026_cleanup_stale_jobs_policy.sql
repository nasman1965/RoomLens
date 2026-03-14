-- ============================================================
-- 0026_cleanup_stale_jobs_policy.sql
-- Removes the old "jobs_owner_access" ALL policy that was
-- left over from a previous migration.
-- The new per-operation policies from 0025 replace it.
-- ============================================================

-- Drop the stale catch-all policy
DROP POLICY IF EXISTS "jobs_owner_access" ON jobs;

-- Verify: should now show only the 4 granular policies
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'jobs'
ORDER BY policyname;
