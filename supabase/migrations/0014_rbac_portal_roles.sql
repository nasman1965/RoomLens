-- ─── MIGRATION 0014: Portal Role-Based Access Control (RBAC) ─────────────────
-- Run in: https://supabase.com/dashboard/project/ilxojqefffravkjxyqlx/sql/new
--
-- Adds portal_role to users table:
--   company_admin    = #1 Full owner, all controls
--   management_admin = #2 Operational, no financials/staff mgmt
--   (staff portal roles stay in team_members.role as before)

-- 1. Add portal_role to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS portal_role TEXT NOT NULL DEFAULT 'company_admin'
  CHECK (portal_role IN ('company_admin', 'management_admin'));

-- 2. All existing users are company_admin by default
UPDATE users SET portal_role = 'company_admin' WHERE portal_role IS NULL OR portal_role = '';

-- 3. Add portal_role to team_members so management admins can be tracked
--    (team_members with portal_role='management_admin' log in via admin portal, not staff portal)
ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS portal_role TEXT NOT NULL DEFAULT 'staff'
  CHECK (portal_role IN ('staff', 'management_admin'));

-- 4. Existing team_members are all staff
UPDATE team_members SET portal_role = 'staff' WHERE portal_role IS NULL OR portal_role = '';

-- 5. Add portal_access_level to users for quick permission checks
--    1 = company_admin, 2 = management_admin
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS access_level INTEGER NOT NULL DEFAULT 1
  CHECK (access_level IN (1, 2));

UPDATE users SET access_level = 1 WHERE portal_role = 'company_admin';

-- 6. View: all admin-level users for a tenant (union of users + mgmt team members)
CREATE OR REPLACE VIEW admin_portal_users AS
SELECT
  u.id,
  u.email,
  u.full_name,
  u.company_name,
  u.portal_role,
  u.access_level,
  NULL::uuid AS team_member_id
FROM users u
UNION ALL
SELECT
  tm.auth_user_id AS id,
  tm.email,
  tm.full_name,
  NULL AS company_name,
  'management_admin' AS portal_role,
  2 AS access_level,
  tm.id AS team_member_id
FROM team_members tm
WHERE tm.portal_role = 'management_admin'
  AND tm.auth_user_id IS NOT NULL;

-- 7. Verify
SELECT id, email, portal_role, access_level FROM users LIMIT 10;
SELECT id, full_name, portal_role FROM team_members LIMIT 10;
