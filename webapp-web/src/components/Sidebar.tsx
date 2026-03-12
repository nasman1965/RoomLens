'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { usePermissions, RoleBadge } from '@/hooks/usePermissions';
import {
  LayoutDashboard, Briefcase,
  FileText, Settings, LogOut, Building2, ChevronRight,
  Package, Users, Shield, Lock,
} from 'lucide-react';

// All possible nav items with their required permission
const ALL_NAV = [
  { href: '/dashboard',  label: 'Dashboard',    icon: LayoutDashboard, permission: 'view_dashboard'  },
  { href: '/jobs',       label: 'Jobs',         icon: Briefcase,       permission: 'view_jobs'       },
  { href: '/employees',  label: 'Employees',    icon: Users,           permission: 'view_employees'  },
  { href: '/equipment',  label: 'Equipment',    icon: Package,         permission: 'view_jobs'       },
  { href: '/reports',    label: 'Reports',      icon: FileText,        permission: 'view_reports'    },
  { href: '/settings',   label: 'Settings',     icon: Settings,        permission: 'settings_profile'},
] as const;

export default function Sidebar() {
  const pathname  = usePathname();
  const router    = useRouter();
  const { can, role, loading, isCompanyAdmin, isManagementAdmin } = usePermissions();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // Filter nav items the current role can see
  const navItems = ALL_NAV.filter(item =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    can(item.permission as any)
  );

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-screen sticky top-0">

      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-700">
        <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
          <Building2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-bold text-sm leading-tight">RoomLensPro</p>
          <p className="text-slate-400 text-xs">Restoration Platform</p>
        </div>
      </div>

      {/* Role badge strip */}
      {!loading && role && (
        <div className="px-4 py-2.5 border-b border-slate-700/60 bg-slate-800/40">
          <div className="flex items-center gap-2">
            {isCompanyAdmin    && <Lock className="w-3 h-3 text-blue-400"   />}
            {isManagementAdmin && <Lock className="w-3 h-3 text-purple-400" />}
            <RoleBadge role={role} />
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {loading ? (
          // Skeleton while permissions load
          <div className="space-y-1">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-10 bg-slate-800/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          navItems.map(({ href, label, icon: Icon }) => {
            const isActive =
              pathname === href ||
              (href !== '/settings' && href !== '/employees' && pathname.startsWith(href + '/')) ||
              (href === '/employees' && pathname.startsWith('/employees'));

            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="text-sm font-medium flex-1">{label}</span>
                {isActive && <ChevronRight className="w-3 h-3 opacity-60" />}
              </Link>
            );
          })
        )}
      </nav>

      {/* Management Admin locked features indicator */}
      {!loading && isManagementAdmin && (
        <div className="mx-3 mb-2 bg-slate-800/60 border border-slate-700 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <Shield className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-xs font-semibold text-slate-300">Restricted Access</span>
          </div>
          <p className="text-[10px] text-slate-500 leading-relaxed">
            Billing, security, notifications & role assignments require Company Admin access.
          </p>
        </div>
      )}

      {/* Super Admin link — company_admin only */}
      {!loading && isCompanyAdmin && (
        <div className="px-3 pb-2">
          <Link href="/super-admin"
            className="w-full flex items-center gap-3 px-3 py-2 text-slate-600 hover:text-red-400 hover:bg-slate-800 rounded-lg transition text-xs">
            <Shield className="w-3.5 h-3.5" />
            <span className="font-medium">Super Admin</span>
          </Link>
        </div>
      )}

      {/* Sign Out */}
      <div className="px-3 py-4 border-t border-slate-700">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition text-sm"
        >
          <LogOut className="w-4 h-4" />
          <span className="font-medium">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
