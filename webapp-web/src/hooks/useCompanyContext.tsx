/**
 * useCompanyContext
 *
 * Returns the correct `ownerUserId` to use in all database queries.
 *
 * Problem being solved:
 *   - company_admin  → their own auth.uid() IS the user_id on jobs/team_members
 *   - management_admin → they live in team_members; the owner (company_admin)
 *     is stored in team_members.user_id. We must query data using that
 *     parent user_id, NOT the management_admin's own auth.uid().
 *
 * Usage:
 *   const { ownerUserId, loading, role } = useCompanyContext()
 *   // wait for loading=false, then use ownerUserId in all .eq('user_id', ownerUserId)
 */

'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type AdminRole = 'company_admin' | 'management_admin' | null;

interface CompanyContext {
  /** The user_id of the company_admin who owns this tenant's data */
  ownerUserId: string;
  /** The currently logged-in user's own auth ID */
  selfUserId: string;
  /** Their role in the admin portal */
  role: AdminRole;
  /** Company name */
  companyName: string;
  /** Loading state — wait for false before querying */
  loading: boolean;
  error: string | null;
}

export function useCompanyContext(): CompanyContext {
  const [ownerUserId,  setOwnerUserId]  = useState('');
  const [selfUserId,   setSelfUserId]   = useState('');
  const [role,         setRole]         = useState<AdminRole>(null);
  const [companyName,  setCompanyName]  = useState('');
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setLoading(false);
          return;
        }

        const myId = session.user.id;
        setSelfUserId(myId);

        // ── Step 1: Check if this auth user is a management_admin ────────────
        // management_admins are in team_members with portal_role='management_admin'
        // and their auth.uid is stored in team_members.auth_user_id
        const { data: mgmtMember } = await supabase
          .from('team_members')
          .select('user_id, portal_role')
          .eq('auth_user_id', myId)
          .eq('portal_role', 'management_admin')
          .maybeSingle();

        if (mgmtMember?.portal_role === 'management_admin') {
          // mgmtMember.user_id is the company_admin who owns all the data
          const ownerId = mgmtMember.user_id as string;
          setOwnerUserId(ownerId);
          setRole('management_admin');

          // Fetch company name from the owner's users row
          const { data: ownerUser } = await supabase
            .from('users')
            .select('company_name')
            .eq('id', ownerId)
            .maybeSingle();
          setCompanyName(ownerUser?.company_name || 'RoomLens Pro');
          setLoading(false);
          return;
        }

        // ── Step 2: Must be a company_admin (or at least in users table) ─────
        const { data: userRow } = await supabase
          .from('users')
          .select('id, company_name, portal_role')
          .eq('id', myId)
          .maybeSingle();

        // company_admin uses their own id as ownerUserId
        setOwnerUserId(myId);
        setRole(
          userRow?.portal_role === 'management_admin'
            ? 'management_admin'
            : 'company_admin'
        );
        setCompanyName(userRow?.company_name || 'RoomLens Pro');
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load company context');
        // Safe fallback — use own id (will at least show company_admin's own data)
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setOwnerUserId(session.user.id);
          setSelfUserId(session.user.id);
        }
        setRole('company_admin');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { ownerUserId, selfUserId, role, companyName, loading, error };
}
