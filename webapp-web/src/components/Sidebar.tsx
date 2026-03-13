'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { usePermissions, RoleBadge } from '@/hooks/usePermissions';
import {
  LayoutDashboard, Briefcase, FileText, Settings, LogOut,
  Building2, ChevronRight, Package, Users, Shield, Lock,
  Menu, X,
} from 'lucide-react';

const ALL_NAV = [
  { href: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard, permission: 'view_dashboard'   },
  { href: '/jobs',       label: 'Jobs',        icon: Briefcase,       permission: 'view_jobs'        },
  { href: '/employees',  label: 'Employees',   icon: Users,           permission: 'view_employees'   },
  { href: '/equipment',  label: 'Equipment',   icon: Package,         permission: 'view_jobs'        },
  { href: '/reports',    label: 'Reports',     icon: FileText,        permission: 'view_reports'     },
  { href: '/settings',   label: 'Settings',    icon: Settings,        permission: 'settings_profile' },
] as const;

// ── Mobile bottom tab bar items (most used) ───────────────────
const BOTTOM_TABS = [
  { href: '/dashboard', label: 'Home',      icon: LayoutDashboard },
  { href: '/jobs',      label: 'Jobs',      icon: Briefcase       },
  { href: '/employees', label: 'Team',      icon: Users           },
  { href: '/settings',  label: 'Settings',  icon: Settings        },
];

interface SidebarProps {
  onClose?: () => void;
}

function SidebarContent({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const { can, role, loading, isCompanyAdmin, isManagementAdmin } = usePermissions();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const navItems = ALL_NAV.filter(item =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    can(item.permission as any)
  );

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-full">

      {/* Logo + close button (mobile only) */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-sm leading-tight">RoomLensPro</p>
            <p className="text-slate-400 text-xs">Restoration Platform</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Role badge */}
      {!loading && role && (
        <div className="px-4 py-2.5 border-b border-slate-700/60 bg-slate-800/40">
          <div className="flex items-center gap-2">
            {isCompanyAdmin    && <Lock className="w-3 h-3 text-blue-400"   />}
            {isManagementAdmin && <Lock className="w-3 h-3 text-purple-400" />}
            <RoleBadge role={role} />
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {loading ? (
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
                onClick={onClose}
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

      {/* Restricted access notice */}
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

      {/* Super admin */}
      {!loading && isCompanyAdmin && (
        <div className="px-3 pb-2">
          <Link
            href="/super-admin"
            onClick={onClose}
            className="w-full flex items-center gap-3 px-3 py-2 text-slate-600 hover:text-red-400 hover:bg-slate-800 rounded-lg transition text-xs"
          >
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

// ── Mobile top header bar ─────────────────────────────────────
function MobileHeader({ onMenuOpen }: { onMenuOpen: () => void }) {
  const pathname = usePathname();

  // Derive page title from pathname
  const pageTitle = () => {
    if (pathname.startsWith('/jobs/new'))    return 'New Job';
    if (pathname.startsWith('/jobs/'))       return 'Job Detail';
    if (pathname === '/jobs')               return 'Jobs';
    if (pathname === '/dashboard')          return 'Dashboard';
    if (pathname.startsWith('/employees'))  return 'Employees';
    if (pathname === '/equipment')          return 'Equipment';
    if (pathname === '/reports')            return 'Reports';
    if (pathname.startsWith('/settings'))   return 'Settings';
    return 'RoomLensPro';
  };

  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-slate-900 border-b border-slate-700/60 px-4 h-14 flex items-center justify-between shadow-lg">
      <button
        onClick={onMenuOpen}
        className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center">
          <Building2 className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-white font-semibold text-sm">{pageTitle()}</span>
      </div>

      {/* Right spacer to keep title centered */}
      <div className="w-9" />
    </header>
  );
}

// ── Mobile bottom nav bar ─────────────────────────────────────
function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-700/60 px-2 pb-safe">
      <div className="flex items-center justify-around">
        {BOTTOM_TABS.map(({ href, label, icon: Icon }) => {
          const isActive =
            pathname === href ||
            (href !== '/settings' && pathname.startsWith(href + '/')) ||
            (href === '/employees' && pathname.startsWith('/employees'));
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-3 py-3 rounded-xl transition min-w-[60px] ${
                isActive ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
              <span className="text-[10px] font-medium">{label}</span>
              {isActive && <div className="w-1 h-1 rounded-full bg-blue-400 mt-0.5" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// ── Main exported Sidebar (handles desktop + mobile drawer) ──
export default function Sidebar() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer on route change
  const pathname = usePathname();
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  return (
    <>
      {/* ── Desktop: always visible sidebar ── */}
      <div className="hidden lg:flex h-screen sticky top-0 shrink-0">
        <SidebarContent />
      </div>

      {/* ── Mobile: top header bar ── */}
      <MobileHeader onMenuOpen={() => setDrawerOpen(true)} />

      {/* ── Mobile: slide-in drawer ── */}
      {/* Backdrop */}
      <div
        className={`lg:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${
          drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setDrawerOpen(false)}
      />
      {/* Drawer panel */}
      <div
        className={`lg:hidden fixed top-0 left-0 z-50 h-full transition-transform duration-300 ease-out ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent onClose={() => setDrawerOpen(false)} />
      </div>

      {/* ── Mobile: bottom nav bar ── */}
      <MobileBottomNav />
    </>
  );
}
