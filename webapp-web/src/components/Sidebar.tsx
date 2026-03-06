'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import {
  LayoutDashboard, Briefcase, Map, Droplets, Camera, FileText,
  Settings, LogOut, Building2, Menu, X, ChevronRight,
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Jobs', href: '/jobs', icon: Briefcase },
  { label: 'Floor Plans', href: '/floorplans', icon: Map },
  { label: 'Moisture Maps', href: '/moisture', icon: Droplets },
  { label: 'Photo Library', href: '/photos', icon: Camera },
  { label: 'Reports', href: '/reports', icon: FileText },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      if (!u) { router.push('/login'); return; }
      setUser(u);
    });
    return unsub;
  }, [router]);

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#e63946' }}>
          <Building2 size={16} className="text-white" />
        </div>
        <div>
          <p className="text-white text-sm font-bold leading-tight">RoomLensPro</p>
          <p className="text-blue-300 text-xs leading-tight">Restoration Platform</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link key={href} href={href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${active ? 'bg-white/15 text-white' : 'text-blue-200 hover:bg-white/10 hover:text-white'}`}>
              <Icon size={17} className={active ? 'text-white' : 'text-blue-300 group-hover:text-white'} />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight size={14} className="text-white/60" />}
            </Link>
          );
        })}
      </nav>

      {/* User + sign out */}
      <div className="px-2 pb-4 border-t border-white/10 pt-3 space-y-0.5">
        <Link href="/settings" onClick={() => setOpen(false)}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${pathname === '/settings' ? 'bg-white/15 text-white' : 'text-blue-200 hover:bg-white/10 hover:text-white'}`}>
          <Settings size={17} />
          <span>Settings</span>
        </Link>
        <button onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-blue-200 hover:bg-red-500/20 hover:text-red-300 transition-all">
          <LogOut size={17} />
          <span>Sign Out</span>
        </button>
        {user && (
          <div className="px-3 pt-2 border-t border-white/10 mt-1">
            <p className="text-white text-xs font-medium truncate">{user.displayName || 'My Company'}</p>
            <p className="text-blue-300 text-xs truncate">{user.email}</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-60 flex-shrink-0 h-screen sticky top-0" style={{ background: '#0a1628' }}>
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-30 flex items-center justify-between px-4 h-14 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#0a1628' }}>
            <Building2 size={15} className="text-white" />
          </div>
          <span className="text-gray-900 text-sm font-bold">RoomLensPro</span>
        </div>
        <button onClick={() => setOpen(!open)} className="text-gray-500 hover:text-gray-800 p-1">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <>
          <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="lg:hidden fixed top-0 left-0 z-50 w-64 h-full" style={{ background: '#0a1628' }}>
            <SidebarContent />
          </aside>
        </>
      )}
    </>
  );
}
