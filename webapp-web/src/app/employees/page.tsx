'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import {
  Users, Search, Plus, Phone, Mail, ChevronRight,
  CheckCircle, Clock, Briefcase, Shield, AlertTriangle,
  User, UserCheck,
} from 'lucide-react';

interface TeamMember {
  id: string;
  full_name: string;
  role: string;
  cell_phone: string | null;
  email: string | null;
  is_active: boolean;
  invite_status: string | null;
  nda_accepted: boolean | null;
  invite_token: string | null;
  created_at: string;
}

const ROLES: Record<string, { label: string; color: string }> = {
  admin:         { label: 'Admin',         color: 'bg-purple-900/60 text-purple-300' },
  office:        { label: 'Office',        color: 'bg-blue-900/60 text-blue-300'    },
  estimator:     { label: 'Estimator',     color: 'bg-cyan-900/60 text-cyan-300'    },
  lead_tech:     { label: 'Lead Tech',     color: 'bg-green-900/60 text-green-300'  },
  tech:          { label: 'Technician',    color: 'bg-teal-900/60 text-teal-300'    },
  subcontractor: { label: 'Subcontractor', color: 'bg-orange-900/60 text-orange-300'},
  other:         { label: 'Other',         color: 'bg-slate-700 text-slate-300'      },
};

export default function EmployeesPage() {
  const router = useRouter();
  const [members, setMembers]   = useState<TeamMember[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'invited' | 'pending'>('all');

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const { data } = await supabase
        .from('team_members')
        .select('id, full_name, role, cell_phone, email, is_active, invite_status, nda_accepted, invite_token, created_at')
        .eq('user_id', session.user.id)
        .order('full_name');

      setMembers(data || []);
      setLoading(false);
    })();
  }, [router]);

  const filtered = members.filter(m => {
    const matchSearch = !search ||
      m.full_name.toLowerCase().includes(search.toLowerCase()) ||
      m.email?.toLowerCase().includes(search.toLowerCase()) ||
      m.role.toLowerCase().includes(search.toLowerCase());

    const matchStatus = filterStatus === 'all' ? true
      : filterStatus === 'active'  ? (m.nda_accepted && m.invite_status === 'active')
      : filterStatus === 'invited' ? m.invite_status === 'invited'
      : filterStatus === 'pending' ? (!m.invite_status || m.invite_status === 'pending')
      : true;

    return matchSearch && matchStatus;
  });

  // Stats
  const totalActive  = members.filter(m => m.nda_accepted && m.invite_status === 'active').length;
  const totalInvited = members.filter(m => m.invite_status === 'invited').length;
  const totalPending = members.filter(m => !m.invite_status || m.invite_status === 'pending').length;

  const getStatusBadge = (m: TeamMember) => {
    if (m.nda_accepted && m.invite_status === 'active')
      return { label: 'Active', cls: 'bg-green-900/60 text-green-300 border-green-700/40', icon: CheckCircle };
    if (m.invite_status === 'invited')
      return { label: 'Invite Sent', cls: 'bg-yellow-900/60 text-yellow-300 border-yellow-700/40', icon: Clock };
    if (m.invite_status === 'suspended')
      return { label: 'Suspended', cls: 'bg-red-900/60 text-red-300 border-red-700/40', icon: AlertTriangle };
    return { label: 'Not Invited', cls: 'bg-slate-700/60 text-slate-400 border-slate-600/40', icon: User };
  };

  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">

        {/* Header */}
        <div className="bg-slate-900 border-b border-slate-700 px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-400 text-xs font-semibold uppercase tracking-widest mb-0.5">
                Team Management
              </p>
              <h1 className="text-white font-bold text-2xl flex items-center gap-2">
                <Users className="w-6 h-6 text-blue-400" /> Employees
              </h1>
              <p className="text-slate-400 text-sm mt-0.5">
                {members.length} team member{members.length !== 1 ? 's' : ''}
              </p>
            </div>
            <Link
              href="/settings?tab=team"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition"
            >
              <Plus className="w-4 h-4" /> Add Employee
            </Link>
          </div>
        </div>

        <div className="p-6 space-y-5">

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Active Staff',   value: totalActive,  color: 'text-green-400',  bg: 'bg-green-900/20 border-green-700/30', icon: UserCheck },
              { label: 'Invite Pending', value: totalInvited, color: 'text-yellow-400', bg: 'bg-yellow-900/20 border-yellow-700/30', icon: Clock },
              { label: 'Not Invited',    value: totalPending, color: 'text-slate-400',  bg: 'bg-slate-800/60 border-slate-700',     icon: User },
            ].map(s => (
              <div key={s.label} className={`${s.bg} border rounded-xl p-4 flex items-center gap-3`}>
                <s.icon className={`w-6 h-6 ${s.color}`} />
                <div>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-slate-400 text-xs">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Search + Filter */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, email or role..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="flex gap-2">
              {(['all', 'active', 'invited', 'pending'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold capitalize transition ${
                    filterStatus === s
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                  }`}
                >
                  {s === 'all' ? `All (${members.length})` : s}
                </button>
              ))}
            </div>
          </div>

          {/* Employee List */}
          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="h-20 bg-slate-800/50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-12 text-center">
              <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-white font-semibold mb-1">
                {search || filterStatus !== 'all' ? 'No employees match your filter' : 'No employees yet'}
              </p>
              <p className="text-slate-500 text-sm mb-4">
                {search || filterStatus !== 'all'
                  ? 'Try a different search or filter'
                  : 'Add your first team member to get started'}
              </p>
              {!search && filterStatus === 'all' && (
                <Link href="/settings?tab=team"
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition">
                  <Plus className="w-4 h-4" /> Add Employee
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(m => {
                const roleInfo  = ROLES[m.role] || ROLES.other;
                const status    = getStatusBadge(m);
                const StatusIcon = status.icon;
                const initials  = m.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

                return (
                  <Link
                    key={m.id}
                    href={`/employees/${m.id}`}
                    className="block bg-slate-800 hover:bg-slate-700/80 border border-slate-700 hover:border-blue-600/50 rounded-xl p-4 transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${
                        m.is_active ? 'bg-blue-900/50 text-blue-300' : 'bg-slate-700 text-slate-500'
                      }`}>
                        {initials}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-white font-semibold text-sm group-hover:text-blue-300 transition">
                            {m.full_name}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${roleInfo.color}`}>
                            {roleInfo.label}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${status.cls}`}>
                            <StatusIcon className="w-2.5 h-2.5" />
                            {status.label}
                          </span>
                          {m.nda_accepted && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-900/60 text-teal-400 flex items-center gap-1">
                              <Shield className="w-2.5 h-2.5" /> NDA ✓
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 flex-wrap">
                          {m.cell_phone && (
                            <span className="flex items-center gap-1 text-xs text-slate-400">
                              <Phone className="w-3 h-3" />{m.cell_phone}
                            </span>
                          )}
                          {m.email && (
                            <span className="flex items-center gap-1 text-xs text-slate-400 truncate">
                              <Mail className="w-3 h-3" />{m.email}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right arrow */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-slate-500 group-hover:text-blue-400 transition hidden sm:block">
                          View Profile
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-blue-400 transition" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
