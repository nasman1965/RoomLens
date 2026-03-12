/**
 * usePermissions — Central RBAC hook for RoomLens Pro admin portal
 *
 * Roles:
 *   company_admin    (#1) — Full owner control over entire tenant portal
 *   management_admin (#2) — Operational access; no financials, billing,
 *                           staff management, or destructive actions
 *
 * Usage:
 *   const { can, role, loading } = usePermissions()
 *   if (!can('delete_jobs')) return <Forbidden />
 */

'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type PortalRole = 'company_admin' | 'management_admin' | null;

export type Permission =
  // Jobs
  | 'view_jobs'
  | 'create_jobs'
  | 'edit_jobs'
  | 'delete_jobs'
  | 'stop_jobs'
  // Dispatch
  | 'dispatch_staff'
  // Employees / Staff
  | 'view_employees'
  | 'add_employees'
  | 'edit_employees'
  | 'delete_employees'
  | 'send_invites'
  | 'approve_staff_requests'
  // Reports
  | 'view_reports'
  | 'export_reports'
  // Settings
  | 'settings_profile'
  | 'settings_team'
  | 'settings_billing'
  | 'settings_notifications'
  | 'settings_security'
  | 'settings_apps'
  // Financials
  | 'view_billing'
  | 'manage_billing'
  // Roles
  | 'assign_roles'
  | 'manage_portal_access'
  // Dashboard
  | 'view_dashboard'
  | 'view_analytics';

// ── Permission map per role ───────────────────────────────────────────────────
const PERMISSIONS: Record<NonNullable<PortalRole>, Permission[]> = {
  company_admin: [
    // ALL permissions
    'view_jobs', 'create_jobs', 'edit_jobs', 'delete_jobs', 'stop_jobs',
    'dispatch_staff',
    'view_employees', 'add_employees', 'edit_employees', 'delete_employees',
    'send_invites', 'approve_staff_requests',
    'view_reports', 'export_reports',
    'settings_profile', 'settings_team', 'settings_billing',
    'settings_notifications', 'settings_security', 'settings_apps',
    'view_billing', 'manage_billing',
    'assign_roles', 'manage_portal_access',
    'view_dashboard', 'view_analytics',
  ],
  management_admin: [
    // Jobs — full access except delete
    'view_jobs', 'create_jobs', 'edit_jobs', 'stop_jobs',
    'dispatch_staff',
    // Staff — CAN manage staff, add/edit/remove, assign jobs
    'view_employees', 'add_employees', 'edit_employees', 'delete_employees',
    'send_invites', 'approve_staff_requests',
    // Reports
    'view_reports', 'export_reports',
    // Settings — profile + team members ONLY
    'settings_profile', 'settings_team',
    // NO: settings_notifications, settings_security, settings_billing, settings_apps
    // NO: view_billing, manage_billing, assign_roles, manage_portal_access, delete_jobs
    'view_dashboard', 'view_analytics',
  ],
};

// ── Hook ──────────────────────────────────────────────────────────────────────
export function usePermissions() {
  const [role,    setRole]    = useState<PortalRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setLoading(false); return; }

        // 1. Check team_members FIRST — management_admins live here
        const { data: member } = await supabase
          .from('team_members')
          .select('portal_role')
          .eq('auth_user_id', session.user.id)
          .eq('portal_role', 'management_admin')
          .maybeSingle();

        if (member?.portal_role === 'management_admin') {
          setRole('management_admin');
          setLoading(false);
          return;
        }

        // 2. Check users table — company_admin lives here
        const { data: user } = await supabase
          .from('users')
          .select('portal_role')
          .eq('id', session.user.id)
          .maybeSingle();

        if (user?.portal_role === 'management_admin') {
          setRole('management_admin');
        } else if (user) {
          // Any user record = company_admin by default
          setRole('company_admin');
        } else {
          // No record found — safe default
          setRole('company_admin');
        }
      } catch {
        setRole('company_admin'); // safe fallback
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /** Check if the current user has a specific permission */
  function can(permission: Permission): boolean {
    if (!role) return false;
    return PERMISSIONS[role]?.includes(permission) ?? false;
  }

  /** Check if user has ANY of the given permissions */
  function canAny(...permissions: Permission[]): boolean {
    return permissions.some(p => can(p));
  }

  /** Check if user has ALL of the given permissions */
  function canAll(...permissions: Permission[]): boolean {
    return permissions.every(p => can(p));
  }

  const isCompanyAdmin    = role === 'company_admin';
  const isManagementAdmin = role === 'management_admin';

  return {
    role,
    loading,
    can,
    canAny,
    canAll,
    isCompanyAdmin,
    isManagementAdmin,
    // Shorthand booleans used across UI
    canManageStaff:   can('add_employees') && can('edit_employees') && can('delete_employees'),
    canViewBilling:   can('view_billing'),
    canManageBilling: can('manage_billing'),
    canAssignRoles:   can('assign_roles'),
    canDeleteJobs:    can('delete_jobs'),
    canDispatch:      can('dispatch_staff'),
  };
}

// ── Access Denied component ───────────────────────────────────────────────────
export function AccessDenied({ feature }: { feature?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-900/30 border border-red-700/40 flex items-center justify-center mb-4">
        <span className="text-3xl">🔒</span>
      </div>
      <h2 className="text-white font-bold text-lg mb-2">Access Restricted</h2>
      <p className="text-slate-400 text-sm max-w-sm">
        {feature
          ? `You don't have permission to access ${feature}.`
          : "You don't have permission to access this feature."}
        {' '}Contact your Company Admin to request access.
      </p>
    </div>
  );
}

// ── Role badge component ──────────────────────────────────────────────────────
export function RoleBadge({ role }: { role: PortalRole }) {
  if (!role) return null;
  const cfg = {
    company_admin:    { label: 'Company Admin',    cls: 'bg-purple-900/60 text-purple-300 border-purple-700/40' },
    management_admin: { label: 'Management Admin', cls: 'bg-blue-900/60 text-blue-300 border-blue-700/40'       },
  };
  const { label, cls } = cfg[role];
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cls}`}>
      {label}
    </span>
  );
}
