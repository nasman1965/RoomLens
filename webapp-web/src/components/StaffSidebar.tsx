'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Briefcase, Camera, Map, Droplets,
  LogOut, Building2, ChevronRight, Clock, User,
} from 'lucide-react';

const STAFF_NAV = [
  { href: '/staff/dashboard', label: 'My Jobs',      icon: Briefcase },
  { href: '/staff/clock',     label: 'Clock In/Out', icon: Clock     },
  { href: '/photos',          label: 'Photos',       icon: Camera    },
  { href: '/floorplans',      label: 'Floor Plans',  icon: Map       },
  { href: '/moisture',        label: 'Moisture Map', icon: Droplets  },
  { href: '/staff/profile',   label: 'My Profile',   icon: User      },
];

export default function StaffSidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const [staffName, setStaffName] = useState('');
  const [staffRole, setStaffRole] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: member } = await supabase
        .from('team_members')
        .select('full_name, role')
        .eq('auth_user_id', session.user.id)
        .single();
      if (member) {
        setStaffName(member.full_name);
        setStaffRole(member.role);
      }
    })();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const initials = staffName
    ? staffName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-700">
        <div className="w-9 h-9 rounded-lg bg-teal-600 flex items-center justify-center shrink-0">
          <Building2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-bold text-sm leading-tight">RoomLensPro</p>
          <p className="text-teal-400 text-xs font-medium">Field Staff Portal</p>
        </div>
      </div>

      {/* Staff identity card */}
      {staffName && (
        <div className="mx-3 mt-3 bg-teal-900/30 border border-teal-700/40 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-teal-600 flex items-center justify-center shrink-0 text-sm font-bold text-white">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm leading-tight truncate">{staffName}</p>
            <p className="text-teal-400 text-xs capitalize">{staffRole.replace('_', ' ')}</p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {STAFF_NAV.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${
                isActive
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="text-sm font-medium flex-1">{label}</span>
              {isActive && <ChevronRight className="w-3 h-3 opacity-60" />}
            </Link>
          );
        })}
      </nav>

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
