'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import AIGenerateButton from '@/components/AIGenerateButton';
import {
  ArrowLeft, User, Phone, Mail, Shield, CheckCircle,
  Briefcase, Clock, MapPin, AlertTriangle,
  ChevronRight, Edit3, ToggleRight, ToggleLeft,
  Trash2, Send, Copy, UserCheck, Activity, Sparkles,
} from 'lucide-react';

interface TeamMember {
  id: string;
  full_name: string;
  role: string;
  cell_phone: string | null;
  email: string | null;
  is_active: boolean;
  notes: string | null;
  invite_status: string | null;
  nda_accepted: boolean | null;
  nda_signed_name: string | null;
  nda_accepted_at: string | null;
  invite_token: string | null;
  invite_sent_at: string | null;
  invite_expires_at: string | null;
  onboarded_at: string | null;
  last_login_at: string | null;
  created_at: string;
}

interface AssignedJob {
  id: string;
  status: string;
  assigned_at: string;
  dispatch_notes: string | null;
  job_id: string;
  insured_name: string;
  property_address: string;
  job_status: string;
  loss_date: string | null;
  insurer_name: string | null;
  clocked_in: boolean;
}

interface ClockEntry {
  id: string;
  clock_in_at: string;
  clock_out_at: string | null;
  job_id: string | null;
  notes: string | null;
  insured_name?: string;
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

const ASSIGN_STATUS_COLORS: Record<string, string> = {
  dispatched:  'bg-blue-900/40 text-blue-300 border-blue-700/40',
  accepted:    'bg-teal-900/40 text-teal-300 border-teal-700/40',
  in_progress: 'bg-yellow-900/40 text-yellow-300 border-yellow-700/40',
  completed:   'bg-green-900/40 text-green-300 border-green-700/40',
  declined:    'bg-red-900/40 text-red-300 border-red-700/40',
};

function formatDuration(inAt: string, outAt: string | null): string {
  const start = new Date(inAt).getTime();
  const end   = outAt ? new Date(outAt).getTime() : Date.now();
  const mins  = Math.round((end - start) / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-CA', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleString('en-CA', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function EmployeeProfilePage() {
  const params = useParams();
  const router = useRouter();
  const memberId = params.id as string;

  const [member,      setMember]      = useState<TeamMember | null>(null);
  const [jobs,        setJobs]        = useState<AssignedJob[]>([]);
  const [clockLog,    setClockLog]    = useState<ClockEntry[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [activeTab,   setActiveTab]   = useState<'overview' | 'jobs' | 'clock' | 'security'>('overview');
  const [copyDone,    setCopyDone]    = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      // Load member
      const { data: m } = await supabase
        .from('team_members')
        .select(`
          id, full_name, role, cell_phone, email, is_active, notes,
          invite_status, nda_accepted, nda_signed_name, nda_accepted_at,
          invite_token, invite_sent_at, invite_expires_at,
          onboarded_at, last_login_at, created_at
        `)
        .eq('id', memberId)
        .eq('user_id', session.user.id)
        .single();

      if (!m) { router.push('/employees'); return; }
      setMember(m);

      // Load job assignments
      const { data: assignments } = await supabase
        .from('job_assignments')
        .select(`
          id, status, assigned_at, dispatch_notes,
          jobs (id, insured_name, property_address, status, loss_date, insurer_name)
        `)
        .eq('member_id', memberId)
        .order('assigned_at', { ascending: false })
        .limit(20);

      if (assignments) {
        // Check clock status for each job
        const mapped = await Promise.all(assignments.map(async (a: any) => {
          const { data: clock } = await supabase
            .from('time_clock_entries')
            .select('id')
            .eq('job_id', a.jobs?.id)
            .eq('member_id', memberId)
            .is('clock_out_at', null)
            .single();
          return {
            id: a.id,
            status: a.status,
            assigned_at: a.assigned_at,
            dispatch_notes: a.dispatch_notes,
            job_id: a.jobs?.id,
            insured_name: a.jobs?.insured_name,
            property_address: a.jobs?.property_address,
            job_status: a.jobs?.status,
            loss_date: a.jobs?.loss_date,
            insurer_name: a.jobs?.insurer_name,
            clocked_in: !!clock,
          };
        }));
        setJobs(mapped);
      }

      // Load clock entries
      const { data: clocks } = await supabase
        .from('time_clock_entries')
        .select('id, clock_in_at, clock_out_at, job_id, notes')
        .eq('member_id', memberId)
        .order('clock_in_at', { ascending: false })
        .limit(30);

      if (clocks) {
        // Enrich with job names
        const enriched = await Promise.all(clocks.map(async (c: any) => {
          if (c.job_id) {
            const { data: job } = await supabase
              .from('jobs').select('insured_name').eq('id', c.job_id).single();
            return { ...c, insured_name: job?.insured_name };
          }
          return c;
        }));
        setClockLog(enriched);
      }

      setLoading(false);
    })();
  }, [memberId, router]);

  const copyInviteLink = () => {
    if (!member?.invite_token) return;
    const link = `${window.location.origin}/staff/invite/${member.invite_token}`;
    navigator.clipboard.writeText(link);
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2000);
  };

  const toggleActive = async () => {
    if (!member) return;
    await supabase.from('team_members').update({ is_active: !member.is_active }).eq('id', member.id);
    setMember({ ...member, is_active: !member.is_active });
  };

  const deleteMember = async () => {
    if (!member) return;
    if (!confirm(`Delete ${member.full_name}? This cannot be undone.`)) return;
    await supabase.from('team_members').delete().eq('id', member.id);
    router.push('/employees');
  };

  if (loading) return (
    <div className="flex bg-slate-950 min-h-screen">
      <Sidebar />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-slate-400 text-sm animate-pulse">Loading profile...</div>
      </div>
    </div>
  );

  if (!member) return null;

  const roleInfo   = ROLES[member.role] || ROLES.other;
  const initials   = member.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const activeJobs = jobs.filter(j => j.status !== 'completed');
  const doneJobs   = jobs.filter(j => j.status === 'completed');
  const totalHours = clockLog.reduce((acc, c) => {
    if (!c.clock_out_at) return acc;
    return acc + (new Date(c.clock_out_at).getTime() - new Date(c.clock_in_at).getTime()) / 3600000;
  }, 0);
  const inviteLink = member.invite_token
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://roomlenspro.com'}/staff/invite/${member.invite_token}`
    : null;

  const statusLabel = member.nda_accepted && member.invite_status === 'active'
    ? { text: 'Active', cls: 'bg-green-900/60 text-green-300 border-green-700/40' }
    : member.invite_status === 'invited'
    ? { text: 'Invite Sent', cls: 'bg-yellow-900/60 text-yellow-300 border-yellow-700/40' }
    : member.invite_status === 'suspended'
    ? { text: 'Suspended', cls: 'bg-red-900/60 text-red-300 border-red-700/40' }
    : { text: 'Not Invited', cls: 'bg-slate-700 text-slate-400 border-slate-600/40' };

  const TABS = [
    { id: 'overview', label: 'Overview',  icon: User     },
    { id: 'jobs',     label: `Jobs (${jobs.length})`,    icon: Briefcase },
    { id: 'clock',    label: `Clock Log (${clockLog.length})`, icon: Clock },
    { id: 'security', label: 'Security',  icon: Shield   },
  ] as const;

  return (
    <div className="flex bg-slate-950 min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0 pb-20 lg:pb-0">

        {/* Top bar */}
        <div className="bg-slate-900 border-b border-slate-700 px-4 py-4">
          <Link href="/employees"
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-4 transition w-fit">
            <ArrowLeft className="w-4 h-4" /> Back to Employees
          </Link>

          {/* Identity row */}
          <div className="flex items-start gap-3 mb-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-base shrink-0 ${
              member.is_active ? 'bg-blue-700 text-white' : 'bg-slate-700 text-slate-400'
            }`}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-white font-bold text-lg leading-tight">{member.full_name}</h1>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${roleInfo.color}`}>
                  {roleInfo.label}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusLabel.cls}`}>
                  {statusLabel.text}
                </span>
                {!member.is_active && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">
                    INACTIVE
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {member.cell_phone && (
                  <a href={`tel:${member.cell_phone}`}
                    className="flex items-center gap-1 text-xs text-blue-400 hover:underline">
                    <Phone className="w-3 h-3" />{member.cell_phone}
                  </a>
                )}
                {member.email && (
                  <a href={`mailto:${member.email}`}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-white truncate max-w-[180px]">
                    <Mail className="w-3 h-3 shrink-0" /><span className="truncate">{member.email}</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Actions row — full width on mobile */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/employees?edit=${member.id}`}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2 rounded-lg transition">
              <Edit3 className="w-3.5 h-3.5" /> Edit
            </Link>
            <button onClick={toggleActive}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2 rounded-lg transition">
              {member.is_active
                ? <><ToggleRight className="w-3.5 h-3.5 text-green-400" /> Deactivate</>
                : <><ToggleLeft className="w-3.5 h-3.5" /> Activate</>}
            </button>
            <button onClick={deleteMember}
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-white bg-slate-800 hover:bg-red-900/40 border border-slate-700 hover:border-red-700/40 px-3 py-2 rounded-lg transition">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </div>

        {/* Stats strip — 2×2 on mobile, 4 cols on desktop */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 border-b border-slate-700">
          {[
            { label: 'Active Jobs',    value: activeJobs.length,          color: 'text-blue-400',   icon: Briefcase   },
            { label: 'Completed',      value: doneJobs.length,            color: 'text-green-400',  icon: CheckCircle },
            { label: 'Clock Sessions', value: clockLog.length,            color: 'text-teal-400',   icon: Clock       },
            { label: 'Total Hours',    value: `${totalHours.toFixed(1)}h`, color: 'text-purple-400', icon: Activity   },
          ].map((s, i) => (
            <div key={s.label} className={`bg-slate-900/60 px-4 py-3 flex items-center gap-2.5 ${
              i % 2 === 0 ? 'border-r border-slate-700' : ''
            } ${
              i < 2 ? 'border-b border-slate-700 sm:border-b-0' : ''
            } ${
              i === 1 || i === 2 ? 'sm:border-r sm:border-slate-700' : ''
            }`}>
              <s.icon className={`w-4 h-4 ${s.color} shrink-0`} />
              <div>
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-slate-500 text-[10px] leading-tight">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs — scrollable on mobile */}
        <div className="bg-slate-900 border-b border-slate-700">
          <div className="flex overflow-x-auto scrollbar-hide px-2 sm:px-6">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-3.5 text-xs sm:text-sm font-medium border-b-2 transition-all whitespace-nowrap shrink-0 ${
                  activeTab === t.id
                    ? 'border-blue-500 text-white'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <t.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-6">

          {/* ── OVERVIEW ───────────────────────────────── */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              {/* Profile Details */}
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
                <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-400" /> Profile Details
                </h3>
                <div className="space-y-3">
                  {[
                    { label: 'Full Name',    value: member.full_name },
                    { label: 'Role',         value: roleInfo.label },
                    { label: 'Email',        value: member.email || '—' },
                    { label: 'Cell Phone',   value: member.cell_phone || '—' },
                    { label: 'Notes',        value: member.notes || '—' },
                    { label: 'Member Since', value: formatDate(member.created_at) },
                    { label: 'Last Login',   value: member.last_login_at ? formatDateTime(member.last_login_at) : 'Never' },
                    { label: 'Onboarded',    value: member.onboarded_at ? formatDate(member.onboarded_at) : 'Pending' },
                  ].map(row => (
                    <div key={row.label} className="flex items-start gap-3">
                      <span className="text-xs text-slate-500 w-28 shrink-0 pt-0.5">{row.label}</span>
                      <span className="text-sm text-white flex-1">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Jobs */}
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
                <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-blue-400" /> Recent Jobs
                </h3>
                {jobs.length === 0 ? (
                  <div className="text-center py-6">
                    <Briefcase className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-slate-500 text-sm">No jobs assigned yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {jobs.slice(0, 5).map(job => (
                      <Link key={job.id} href={`/jobs/${job.job_id}`}
                        className="flex items-center gap-3 p-3 bg-slate-700/40 hover:bg-slate-700 rounded-lg transition group">
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-xs font-semibold truncate group-hover:text-blue-300 transition">
                            {job.insured_name}
                          </p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <MapPin className="w-2.5 h-2.5 text-slate-500" />
                            <span className="text-slate-500 text-[10px] truncate">{job.property_address}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${ASSIGN_STATUS_COLORS[job.status] || ASSIGN_STATUS_COLORS.dispatched}`}>
                            {job.status.replace('_',' ').toUpperCase()}
                          </span>
                          {job.clocked_in && (
                            <span className="text-[10px] text-green-400 font-bold animate-pulse">● ON SITE</span>
                          )}
                        </div>
                        <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-white" />
                      </Link>
                    ))}
                    {jobs.length > 5 && (
                      <button onClick={() => setActiveTab('jobs')}
                        className="w-full text-center text-xs text-blue-400 hover:text-blue-300 py-2 transition">
                        View all {jobs.length} jobs →
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Clock Summary */}
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
                <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-400" /> Recent Clock Activity
                </h3>
                {clockLog.length === 0 ? (
                  <div className="text-center py-6">
                    <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-slate-500 text-sm">No clock entries yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {clockLog.slice(0, 5).map(c => (
                      <div key={c.id} className="flex items-center gap-3 p-3 bg-slate-700/40 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-xs font-medium truncate">
                            {c.insured_name || 'General Clock-In'}
                          </p>
                          <p className="text-slate-500 text-[10px] mt-0.5">
                            {formatDateTime(c.clock_in_at)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          {c.clock_out_at ? (
                            <span className="text-teal-400 text-xs font-semibold">
                              {formatDuration(c.clock_in_at, c.clock_out_at)}
                            </span>
                          ) : (
                            <span className="text-green-400 text-xs font-bold animate-pulse">ACTIVE</span>
                          )}
                        </div>
                      </div>
                    ))}
                    {clockLog.length > 5 && (
                      <button onClick={() => setActiveTab('clock')}
                        className="w-full text-center text-xs text-blue-400 hover:text-blue-300 py-2 transition">
                        View full clock log →
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* NDA / Security Status */}
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
                <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-400" /> Account & Security
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">NDA Status</span>
                    {member.nda_accepted ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-green-400">
                        <CheckCircle className="w-3.5 h-3.5" /> Signed
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-semibold text-yellow-400">
                        <AlertTriangle className="w-3.5 h-3.5" /> Pending
                      </span>
                    )}
                  </div>
                  {member.nda_signed_name && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Signed As</span>
                      <span className="text-xs text-white italic">{member.nda_signed_name}</span>
                    </div>
                  )}
                  {member.nda_accepted_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Signed On</span>
                      <span className="text-xs text-white">{formatDate(member.nda_accepted_at)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Invite Status</span>
                    <span className={`text-xs font-semibold border px-2 py-0.5 rounded-full ${statusLabel.cls}`}>
                      {statusLabel.text}
                    </span>
                  </div>
                  {member.invite_sent_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Invite Sent</span>
                      <span className="text-xs text-white">{formatDate(member.invite_sent_at)}</span>
                    </div>
                  )}
                  {member.invite_expires_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Invite Expires</span>
                      <span className={`text-xs ${new Date(member.invite_expires_at) < new Date() ? 'text-red-400' : 'text-white'}`}>
                        {formatDate(member.invite_expires_at)}
                        {new Date(member.invite_expires_at) < new Date() && ' (expired)'}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Portal Access</span>
                    <span className={`text-xs font-semibold ${member.is_active ? 'text-green-400' : 'text-red-400'}`}>
                      {member.is_active ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>

                {/* Invite link copy */}
                {inviteLink && member.invite_status !== 'active' && (
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <p className="text-xs text-slate-500 mb-2">Invite Link</p>
                    <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-600 rounded-lg px-3 py-2">
                      <code className="text-teal-300 text-[10px] flex-1 truncate">{inviteLink}</code>
                      <button onClick={copyInviteLink}
                        className="shrink-0 text-slate-400 hover:text-teal-300 transition" title="Copy link">
                        {copyDone ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      {member.cell_phone && (
                        <a href={`sms:${member.cell_phone}?body=${encodeURIComponent(
                          `Hi ${member.full_name.split(' ')[0]}! Here is your RoomLens Pro invite link: ${inviteLink}`
                        )}`}
                          className="shrink-0 text-slate-400 hover:text-teal-300 transition" title="Send via text">
                          <Send className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── JOBS TAB ───────────────────────────────── */}
          {activeTab === 'jobs' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-white font-semibold text-base">
                  All Assigned Jobs ({jobs.length})
                </h3>
              </div>
              {jobs.length === 0 ? (
                <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-12 text-center">
                  <Briefcase className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">No jobs assigned to this staff member yet.</p>
                </div>
              ) : (
                jobs.map(job => (
                  <Link key={job.id} href={`/jobs/${job.job_id}`}
                    className="block bg-slate-800 hover:bg-slate-700/80 border border-slate-700 hover:border-blue-600/40 rounded-xl p-4 transition group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${ASSIGN_STATUS_COLORS[job.status] || ASSIGN_STATUS_COLORS.dispatched}`}>
                            {job.status.replace('_',' ').toUpperCase()}
                          </span>
                          {job.clocked_in && (
                            <span className="text-[10px] font-bold text-green-400 animate-pulse">● ON SITE</span>
                          )}
                        </div>
                        <p className="text-white font-semibold text-sm group-hover:text-blue-300 transition">{job.insured_name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          <span className="text-slate-400 text-xs">{job.property_address}</span>
                        </div>
                        {job.insurer_name && (
                          <p className="text-slate-500 text-xs mt-0.5">📋 {job.insurer_name}</p>
                        )}
                        {job.dispatch_notes && (
                          <div className="mt-2 bg-yellow-900/20 border border-yellow-700/30 rounded-lg px-3 py-1.5">
                            <p className="text-yellow-300 text-xs">📝 {job.dispatch_notes}</p>
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-slate-500 text-[10px]">{formatDate(job.assigned_at)}</p>
                        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-blue-400 mt-1 ml-auto" />
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          )}

          {/* ── CLOCK LOG TAB ──────────────────────────── */}
          {activeTab === 'clock' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-white font-semibold text-base">
                  Clock History ({clockLog.length} sessions · {totalHours.toFixed(1)}h total)
                </h3>
              </div>
              {clockLog.length === 0 ? (
                <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-12 text-center">
                  <Clock className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">No clock entries yet.</p>
                </div>
              ) : (
                <div className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
                  {/* Mobile: card list */}
                  <div className="sm:hidden divide-y divide-slate-700/60">
                    {clockLog.map(c => (
                      <div key={c.id} className="px-4 py-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-white text-xs font-semibold truncate flex-1 mr-2">
                            {c.insured_name || <span className="text-slate-500 italic">No job</span>}
                          </p>
                          <span className={`text-xs font-bold shrink-0 ${c.clock_out_at ? 'text-teal-400' : 'text-green-400 animate-pulse'}`}>
                            {formatDuration(c.clock_in_at, c.clock_out_at)}
                          </span>
                        </div>
                        <p className="text-slate-500 text-[10px]">
                          In: {formatDateTime(c.clock_in_at)}
                          {c.clock_out_at
                            ? ` · Out: ${formatDateTime(c.clock_out_at)}`
                            : <span className="text-green-400 font-bold"> · Still clocked in</span>}
                        </p>
                      </div>
                    ))}
                  </div>
                  {/* Desktop: table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-900/60 border-b border-slate-700">
                        <tr>
                          <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">Job</th>
                          <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">Clock In</th>
                          <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">Clock Out</th>
                          <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">Duration</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/60">
                        {clockLog.map(c => (
                          <tr key={c.id} className="hover:bg-slate-700/30 transition">
                            <td className="px-4 py-3 text-white text-xs">
                              {c.insured_name || <span className="text-slate-500 italic">No job</span>}
                            </td>
                            <td className="px-4 py-3 text-slate-300 text-xs">{formatDateTime(c.clock_in_at)}</td>
                            <td className="px-4 py-3 text-xs">
                              {c.clock_out_at
                                ? <span className="text-slate-300">{formatDateTime(c.clock_out_at)}</span>
                                : <span className="text-green-400 font-bold animate-pulse">Still clocked in</span>
                              }
                            </td>
                            <td className="px-4 py-3 text-xs">
                              <span className={`font-semibold ${c.clock_out_at ? 'text-teal-400' : 'text-green-400'}`}>
                                {formatDuration(c.clock_in_at, c.clock_out_at)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── SECURITY TAB ───────────────────────────── */}
          {activeTab === 'security' && (
            <div className="max-w-lg space-y-5">

              {/* AI Performance Summary */}
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
                <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-400" /> AI Performance Summary
                </h3>
                <p className="text-slate-400 text-xs mb-3">
                  Generate a professional performance review based on this staff member&apos;s job history, hours logged, and account activity.
                </p>
                <AIGenerateButton
                  label="Generate Performance Summary"
                  onGenerate={async () => {
                    const res = await fetch('/api/ai/generate', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        type: 'performance_summary',
                        staff: {
                          full_name: member.full_name,
                          role: member.role,
                          created_at: formatDate(member.created_at),
                          invite_status: member.invite_status,
                          nda_accepted: member.nda_accepted,
                        },
                        stats: {
                          total_jobs: jobs.length,
                          active_jobs: activeJobs.length,
                          completed_jobs: doneJobs.length,
                          clock_sessions: clockLog.length,
                          total_hours: totalHours,
                          last_login: member.last_login_at ? formatDateTime(member.last_login_at) : null,
                        },
                      }),
                    });
                    const data = await res.json();
                    if (data.error) throw new Error(data.error);
                    return data.result;
                  }}
                />
              </div>

              {/* AI Incident Note */}
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
                <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-400" /> AI Incident Note
                </h3>
                <p className="text-slate-400 text-xs mb-3">Describe an incident in plain words — AI will write a formal HR note.</p>
                <IncidentNoteGenerator member={member} />
              </div>

              {/* NDA Record */}
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
                <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-teal-400" /> NDA / Confidentiality Agreement
                </h3>
                {member.nda_accepted ? (
                  <div className="space-y-3">
                    <div className="bg-green-900/20 border border-green-700/30 rounded-lg px-4 py-3 flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
                      <div>
                        <p className="text-green-300 text-sm font-semibold">NDA Signed & Accepted</p>
                        <p className="text-green-400/60 text-xs">Version 1.0</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-900/60 rounded-lg px-4 py-3">
                        <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Signed Name</p>
                        <p className="text-white text-sm italic font-medium">{member.nda_signed_name || '—'}</p>
                      </div>
                      <div className="bg-slate-900/60 rounded-lg px-4 py-3">
                        <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Date Signed</p>
                        <p className="text-white text-sm">{member.nda_accepted_at ? formatDate(member.nda_accepted_at) : '—'}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg px-4 py-3 flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0" />
                    <div>
                      <p className="text-yellow-300 text-sm font-semibold">NDA Not Yet Signed</p>
                      <p className="text-yellow-400/60 text-xs">Staff must complete onboarding via invite link</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Invite Details */}
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
                <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-blue-400" /> Onboarding / Invite Details
                </h3>
                <div className="space-y-3">
                  {[
                    { label: 'Invite Status', value: statusLabel.text },
                    { label: 'Invite Sent',   value: member.invite_sent_at ? formatDateTime(member.invite_sent_at) : 'Not sent' },
                    { label: 'Link Expires',  value: member.invite_expires_at
                        ? `${formatDate(member.invite_expires_at)}${new Date(member.invite_expires_at) < new Date() ? ' ⚠️ expired' : ''}`
                        : '—' },
                    { label: 'Onboarded',     value: member.onboarded_at ? formatDate(member.onboarded_at) : 'Pending' },
                    { label: 'Last Login',    value: member.last_login_at ? formatDateTime(member.last_login_at) : 'Never' },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">{row.label}</span>
                      <span className="text-xs text-white">{row.value}</span>
                    </div>
                  ))}
                </div>

                {/* Invite link */}
                {inviteLink && member.invite_status !== 'active' && (
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <p className="text-xs font-semibold text-slate-400 mb-2">Invite Link</p>
                    <div className="flex items-center gap-2 bg-slate-900/60 border border-teal-700/40 rounded-lg px-3 py-2">
                      <code className="text-teal-300 text-[10px] flex-1 break-all">{inviteLink}</code>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button onClick={copyInviteLink}
                        className="flex items-center gap-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-lg transition">
                        {copyDone ? <><CheckCircle className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy Link</>}
                      </button>
                      {member.cell_phone && (
                        <a href={`sms:${member.cell_phone}?body=${encodeURIComponent(
                          `Hi ${member.full_name.split(' ')[0]}! Click to set up your RoomLens Pro account: ${inviteLink}`
                        )}`}
                          className="flex items-center gap-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg transition">
                          <Send className="w-3 h-3" /> Send via Text
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Danger zone */}
              <div className="bg-red-900/10 border border-red-700/30 rounded-xl p-5">
                <h3 className="text-red-400 font-semibold text-sm mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Danger Zone
                </h3>
                <div className="flex gap-3 flex-wrap">
                  <button onClick={toggleActive}
                    className="flex items-center gap-2 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white px-4 py-2 rounded-lg transition">
                    {member.is_active
                      ? <><ToggleRight className="w-3.5 h-3.5 text-yellow-400" /> Deactivate Account</>
                      : <><ToggleLeft className="w-3.5 h-3.5" /> Reactivate Account</>
                    }
                  </button>
                  <button onClick={deleteMember}
                    className="flex items-center gap-2 text-xs bg-red-900/40 hover:bg-red-900/70 border border-red-700/40 text-red-300 hover:text-white px-4 py-2 rounded-lg transition">
                    <Trash2 className="w-3.5 h-3.5" /> Delete Staff Member
                  </button>
                </div>
                <p className="text-red-400/50 text-[10px] mt-3">
                  Deleting is permanent and removes all assignments. Deactivating preserves history.
                </p>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

// ── Incident Note Generator sub-component ─────────────────────────────────────
function IncidentNoteGenerator({ member }: { member: TeamMember }) {
  const [description, setDescription] = useState('');
  const [loading, setLoading]         = useState(false);
  const [result, setResult]           = useState('');
  const [error, setError]             = useState('');
  const [copied, setCopied]           = useState(false);

  const generate = async () => {
    if (!description.trim()) { setError('Please describe the incident first.'); return; }
    setLoading(true); setError(''); setResult('');
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'incident_note',
          staff_name: member.full_name,
          staff_role: member.role,
          incident_description: description,
          date: new Date().toLocaleDateString('en-CA'),
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data.result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="e.g. Staff arrived 2 hours late without notice, no response to calls..."
        rows={3}
        className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:ring-2 focus:ring-violet-500 outline-none resize-none"
      />
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <button
        onClick={generate}
        disabled={loading || !description.trim()}
        className="flex items-center gap-2 text-xs px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/40 disabled:opacity-50 text-violet-300 border border-violet-500/30 rounded-lg transition font-semibold"
      >
        {loading
          ? <><span className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />Generating...</>
          : <><Sparkles className="w-3 h-3" />Write Incident Note</>
        }
      </button>
      {result && (
        <div className="bg-violet-900/20 border border-violet-600/40 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-violet-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> AI Generated
            </span>
            <button onClick={copy} className="text-slate-400 hover:text-violet-300 transition text-xs flex items-center gap-1">
              {copied ? <><CheckCircle className="w-3 h-3 text-green-400" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
            </button>
          </div>
          <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">{result}</p>
        </div>
      )}
    </div>
  );
}
