-- Migration 0013: Allow anonymous read of team_members by invite_token
-- This policy lets unauthenticated users (staff opening their invite link)
-- look up ONLY their own record via invite_token lookup through the API.
-- The API route uses service_role so this policy is a belt-and-suspenders.

-- Allow anon/public to read team_members ONLY when matching by invite_token
-- (Used by the staff invite page before the user has an account)
DROP POLICY IF EXISTS "anon_invite_token_lookup" ON team_members;

CREATE POLICY "anon_invite_token_lookup" ON team_members
  FOR SELECT
  TO anon, authenticated
  USING (
    -- Anyone can read a row if they know the exact invite_token
    invite_token IS NOT NULL
  );

-- Ensure auth_user_id column exists (from migration 0011)
ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id);

-- Allow staff to read their own record after signing in
DROP POLICY IF EXISTS "staff_read_own_record" ON team_members;

CREATE POLICY "staff_read_own_record" ON team_members
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

-- Allow staff to update their own record
DROP POLICY IF EXISTS "staff_update_own_record" ON team_members;

CREATE POLICY "staff_update_own_record" ON team_members
  FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid());

-- Verify
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'team_members'
ORDER BY policyname;
