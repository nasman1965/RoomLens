-- ============================================================
-- 0025_management_admin_rls.sql
-- Allows management_admin users to read/write their company's
-- jobs and team_members using the same RLS policies.
--
-- Problem: management_admin has portal_role='management_admin'
-- in team_members.  Their auth.uid() != the company_admin's
-- user_id, so .eq('user_id', session.user.id) returns nothing.
--
-- Fix strategy:
--   Add a helper function get_company_owner_id() that returns
--   the owning company_admin's user_id for the current user.
--   Then update RLS policies on jobs and team_members to ALSO
--   allow access when the current user is a management_admin
--   for that company.
--
-- Run in: https://supabase.com/dashboard/project/ilxojqefffravkjxyqlx/sql/new
-- ============================================================

-- ── 1. Helper function: get the company owner id for current user ─────────────
-- Returns the user_id of the company_admin who owns this user's team.
-- If current user IS the company_admin, returns their own id.
-- If current user is a management_admin, returns their manager's user_id.
CREATE OR REPLACE FUNCTION get_company_owner_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    -- If current user is a management_admin in team_members, return their owner
    (
      SELECT user_id
      FROM team_members
      WHERE auth_user_id = auth.uid()
        AND portal_role = 'management_admin'
      LIMIT 1
    ),
    -- Otherwise, current user is the owner (company_admin)
    auth.uid()
  );
$$;

-- ── 2. Update jobs RLS to allow management_admin access ──────────────────────
-- Current policy: user_id = auth.uid()
-- New policy: user_id = get_company_owner_id()

-- Drop existing jobs policies and recreate them
DROP POLICY IF EXISTS "jobs_owner" ON jobs;
DROP POLICY IF EXISTS "jobs_select" ON jobs;
DROP POLICY IF EXISTS "jobs_insert" ON jobs;
DROP POLICY IF EXISTS "jobs_update" ON jobs;
DROP POLICY IF EXISTS "jobs_delete" ON jobs;

CREATE POLICY "jobs_select" ON jobs
  FOR SELECT TO authenticated
  USING (user_id = get_company_owner_id());

CREATE POLICY "jobs_insert" ON jobs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = get_company_owner_id());

CREATE POLICY "jobs_update" ON jobs
  FOR UPDATE TO authenticated
  USING (user_id = get_company_owner_id())
  WITH CHECK (user_id = get_company_owner_id());

CREATE POLICY "jobs_delete" ON jobs
  FOR DELETE TO authenticated
  USING (user_id = get_company_owner_id());

-- ── 3. Update team_members RLS to allow management_admin access ───────────────
-- Drop existing team_members policies and recreate them
DROP POLICY IF EXISTS "team_members_owner" ON team_members;
DROP POLICY IF EXISTS "team_members_select" ON team_members;
DROP POLICY IF EXISTS "team_members_insert" ON team_members;
DROP POLICY IF EXISTS "team_members_update" ON team_members;
DROP POLICY IF EXISTS "team_members_delete" ON team_members;

CREATE POLICY "team_members_select" ON team_members
  FOR SELECT TO authenticated
  USING (user_id = get_company_owner_id());

CREATE POLICY "team_members_insert" ON team_members
  FOR INSERT TO authenticated
  WITH CHECK (user_id = get_company_owner_id());

CREATE POLICY "team_members_update" ON team_members
  FOR UPDATE TO authenticated
  USING (user_id = get_company_owner_id())
  WITH CHECK (user_id = get_company_owner_id());

CREATE POLICY "team_members_delete" ON team_members
  FOR DELETE TO authenticated
  USING (user_id = get_company_owner_id());

-- ── 4. Verify ────────────────────────────────────────────────────────────────
SELECT 'get_company_owner_id() function created' AS status;

SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename IN ('jobs', 'team_members')
ORDER BY tablename, policyname;
