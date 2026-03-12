'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import {
  Users, Search, Plus, Phone, Mail, ChevronRight,
  CheckCircle, Clock, Briefcase, Shield, AlertTriangle,
  User, UserCheck, X, Send, Copy, ExternalLink, Lock,
  Eye, EyeOff, Loader2, Edit3, ToggleLeft, ToggleRight, Trash2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
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
  invite_token: string | null;
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ROLES: Record<string, { label: string; color: string }> = {
  admin:         { label: 'Admin',         color: 'bg-purple-900/60 text-purple-300' },
  office:        { label: 'Office',        color: 'bg-blue-900/60 text-blue-300'    },
  estimator:     { label: 'Estimator',     color: 'bg-cyan-900/60 text-cyan-300'    },
  lead_tech:     { label: 'Lead Tech',     color: 'bg-green-900/60 text-green-300'  },
  tech:          { label: 'Technician',    color: 'bg-teal-900/60 text-teal-300'    },
  subcontractor: { label: 'Subcontractor', color: 'bg-orange-900/60 text-orange-300'},
  other:         { label: 'Other',         color: 'bg-slate-700 text-slate-300'      },
};

const BLANK_MEMBER = {
  full_name: '', role: 'tech', cell_phone: '', email: '', notes: '', temp_password: '',
};

const inputCls = 'w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition';

// ─── Helper components ────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Alert({ type, msg }: { type: 'success' | 'error'; msg: string }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
      type === 'success'
        ? 'bg-green-900/30 border border-green-700/40 text-green-300'
        : 'bg-red-900/30 border border-red-700/40 text-red-300'
    }`}>
      {type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
      {msg}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function EmployeesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Data
  const [userId,  setUserId]  = useState('');
  const [companyName, setCompanyName] = useState('RoomLens Pro');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  // List UI
  const [search,       setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'invited' | 'pending'>('all');

  // Form
  const [showForm,     setShowForm]     = useState(false);
  const [editId,       setEditId]       = useState<string | null>(null);
  const [memberForm,   setMemberForm]   = useState(BLANK_MEMBER);
  const [savingMember, setSavingMember] = useState(false);
  const [memberErr,    setMemberErr]    = useState('');
  const [memberOk,     setMemberOk]     = useState('');
  const [showTempPw,   setShowTempPw]   = useState(false);

  // Invite result
  const [inviteResult, setInviteResult] = useState<{
    url: string; sms: string; name: string; phone: string; smsSent?: boolean;
  } | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  const fetchTeam = useCallback(async (uid?: string) => {
    const id = uid || userId;
    if (!id) return;
    const { data } = await supabase
      .from('team_members')
      .select('id, full_name, role, cell_phone, email, is_active, notes, invite_status, nda_accepted, invite_token, created_at')
      .eq('user_id', id)
      .order('full_name');
    setMembers(data || []);
    return data || [];
  }, [userId]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setUserId(session.user.id);

      // Grab company name
      const { data: rec } = await supabase
        .from('users').select('company_name').eq('id', session.user.id).single();
      if (rec?.company_name) setCompanyName(rec.company_name);

      const list = await fetchTeam(session.user.id) as TeamMember[] | undefined;
      setLoading(false);

      // Handle ?edit=<id> from profile page Edit button
      const editParam = searchParams.get('edit');
      if (editParam && list) {
        const target = list.find((m: TeamMember) => m.id === editParam);
        if (target) {
          setEditId(target.id);
          setMemberForm({ full_name: target.full_name, role: target.role, cell_phone: target.cell_phone || '', email: target.email || '', notes: target.notes || '', temp_password: '' });
          setShowForm(true);
          setTimeout(() => document.getElementById('emp-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // ── Form actions ──────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditId(null);
    setMemberForm(BLANK_MEMBER);
    setMemberErr('');
    setMemberOk('');
    setInviteResult(null);
    setShowTempPw(false);
    setShowForm(true);
    // scroll form into view
    setTimeout(() => document.getElementById('emp-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const openEdit = (m: TeamMember) => {
    setEditId(m.id);
    setMemberForm({ full_name: m.full_name, role: m.role, cell_phone: m.cell_phone || '', email: m.email || '', notes: m.notes || '', temp_password: '' });
    setMemberErr('');
    setMemberOk('');
    setInviteResult(null);
    setShowTempPw(false);
    setShowForm(true);
    setTimeout(() => document.getElementById('emp-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const saveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberForm.full_name.trim())    { setMemberErr('Name is required.'); return; }
    if (!editId && !memberForm.email?.trim())         { setMemberErr('Email is required to send invite.'); return; }
    if (!editId && !memberForm.temp_password?.trim()) { setMemberErr('Temporary password is required.'); return; }
    setSavingMember(true); setMemberErr(''); setMemberOk('');
    try {
      if (editId) {
        const { error } = await supabase.from('team_members').update({
          full_name: memberForm.full_name, role: memberForm.role,
          cell_phone: memberForm.cell_phone || null,
          email: memberForm.email || null, notes: memberForm.notes || null,
        }).eq('id', editId);
        if (error) { setMemberErr(error.message); return; }
        setMemberOk('Member updated.'); setShowForm(false); fetchTeam();
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { temp_password: _tp, ...memberData } = memberForm;
        const { data: newMember, error: insertError } = await supabase
          .from('team_members')
          .insert({ ...memberData, user_id: userId, is_active: true })
          .select('id').single();
        if (insertError || !newMember) { setMemberErr(insertError?.message || 'Insert failed.'); return; }

        const res = await fetch('/api/staff/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            member_id: newMember.id,
            email: memberForm.email,
            full_name: memberForm.full_name,
            temp_password: memberForm.temp_password,
            company_name: companyName,
            admin_user_id: userId,
            cell_phone: memberForm.cell_phone || null,
          }),
        });
        const result = await res.json();
        if (result.success) {
          setInviteResult({
            url: result.invite_url,
            sms: result.sms_message,
            name: memberForm.full_name,
            phone: memberForm.cell_phone || '',
            smsSent: result.sms_sent || false,
          });
          setMemberOk('');
          setShowForm(false);
          fetchTeam();
        } else {
          setMemberErr(result.error || 'Invite failed.');
        }
      }
    } catch (err: unknown) {
      setMemberErr('Save failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally { setSavingMember(false); }
  };

  const toggleActive = async (m: TeamMember) => {
    await supabase.from('team_members').update({ is_active: !m.is_active }).eq('id', m.id);
    fetchTeam();
  };

  const deleteMember = async (id: string, name: string) => {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    await supabase.from('team_members').delete().eq('id', id);
    fetchTeam();
  };

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = members.filter(m => {
    const matchSearch = !search
      || m.full_name.toLowerCase().includes(search.toLowerCase())
      || m.email?.toLowerCase().includes(search.toLowerCase())
      || m.role.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      filterStatus === 'all'     ? true
      : filterStatus === 'active'  ? (m.nda_accepted && m.invite_status === 'active')
      : filterStatus === 'invited' ? m.invite_status === 'invited'
      : filterStatus === 'pending' ? (!m.invite_status || m.invite_status === 'pending')
      : true;
    return matchSearch && matchStatus;
  });

  const totalActive  = members.filter(m => m.nda_accepted && m.invite_status === 'active').length;
  const totalInvited = members.filter(m => m.invite_status === 'invited').length;
  const totalPending = members.filter(m => !m.invite_status || m.invite_status === 'pending').length;

  const getStatusBadge = (m: TeamMember) => {
    if (m.nda_accepted && m.invite_status === 'active')
      return { label: 'Active',      cls: 'bg-green-900/60 text-green-300 border-green-700/40',   icon: CheckCircle };
    if (m.invite_status === 'invited')
      return { label: 'Invite Sent', cls: 'bg-yellow-900/60 text-yellow-300 border-yellow-700/40', icon: Clock };
    if (m.invite_status === 'suspended')
      return { label: 'Suspended',   cls: 'bg-red-900/60 text-red-300 border-red-700/40',          icon: AlertTriangle };
    return   { label: 'Not Invited', cls: 'bg-slate-700/60 text-slate-400 border-slate-600/40',    icon: User };
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">

        {/* ── Header ──────────────────────────────────────────────────────── */}
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
            <button
              onClick={openAdd}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition"
            >
              <Plus className="w-4 h-4" /> Add Employee
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">

          {/* ── Stats Row ───────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Active Staff',   value: totalActive,  color: 'text-green-400',  bg: 'bg-green-900/20 border-green-700/30',  icon: UserCheck },
              { label: 'Invite Pending', value: totalInvited, color: 'text-yellow-400', bg: 'bg-yellow-900/20 border-yellow-700/30', icon: Clock },
              { label: 'Not Invited',   value: totalPending, color: 'text-slate-400',  bg: 'bg-slate-800/60 border-slate-700',      icon: User },
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

          {/* ── Success alert ────────────────────────────────────────────── */}
          {memberOk && <Alert type="success" msg={memberOk} />}

          {/* ── Add / Edit Form ──────────────────────────────────────────── */}
          {showForm && (
            <div id="emp-form" className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">
                  {editId ? 'Edit Employee' : 'Add Employee & Send Invite'}
                </h3>
                <button type="button" onClick={() => setShowForm(false)}>
                  <X className="w-4 h-4 text-slate-400 hover:text-white" />
                </button>
              </div>
              {memberErr && <div className="mb-3"><Alert type="error" msg={memberErr} /></div>}
              <form onSubmit={saveMember} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Full Name *">
                    <input type="text" value={memberForm.full_name}
                      onChange={e => setMemberForm(p => ({ ...p, full_name: e.target.value }))}
                      placeholder="Jane Doe" className={inputCls} required />
                  </Field>
                  <Field label="Role">
                    <select value={memberForm.role}
                      onChange={e => setMemberForm(p => ({ ...p, role: e.target.value }))}
                      className={inputCls}>
                      {Object.entries(ROLES).map(([v, r]) => (
                        <option key={v} value={v}>{r.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Cell Phone">
                    <input type="tel" value={memberForm.cell_phone}
                      onChange={e => setMemberForm(p => ({ ...p, cell_phone: e.target.value }))}
                      placeholder="(555) 123-4567" className={inputCls} />
                  </Field>
                  <Field label={`Email${!editId ? ' *' : ''}`}>
                    <input type="email" value={memberForm.email}
                      onChange={e => setMemberForm(p => ({ ...p, email: e.target.value }))}
                      placeholder="jane@company.com" className={inputCls} />
                  </Field>
                </div>
                <Field label="Notes">
                  <input type="text" value={memberForm.notes}
                    onChange={e => setMemberForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Optional notes" className={inputCls} />
                </Field>

                {/* Temp password — new member only */}
                {!editId && (
                  <div className="bg-teal-900/20 border border-teal-700/40 rounded-xl p-4">
                    <p className="text-teal-300 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" /> Staff Login Setup
                    </p>
                    <p className="text-slate-400 text-xs mb-3">
                      Create a temporary password. Staff will use this to access the invite link and will set their own password during onboarding.
                    </p>
                    <Field label="Temporary Password *">
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type={showTempPw ? 'text' : 'password'}
                          value={memberForm.temp_password}
                          onChange={e => setMemberForm(p => ({ ...p, temp_password: e.target.value }))}
                          placeholder="Min. 8 characters (e.g. Staff2026!)"
                          className="w-full pl-10 pr-10 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-400 focus:ring-2 focus:ring-teal-500 outline-none"
                          required
                        />
                        <button type="button" onClick={() => setShowTempPw(!showTempPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition">
                          {showTempPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </Field>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button type="submit" disabled={savingMember}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-semibold py-2 px-5 rounded-lg transition text-sm">
                    {savingMember ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {editId ? 'Update Member' : 'Create & Send Invite'}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)}
                    className="py-2 px-5 rounded-lg text-sm font-medium text-slate-400 hover:text-white border border-slate-600 hover:border-slate-500 transition">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── Invite Result Banner ─────────────────────────────────────── */}
          {inviteResult && (
            <div className="bg-teal-900/20 border border-teal-600/40 rounded-2xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-base">Invite Created!</p>
                    <p className="text-teal-300 text-xs">
                      Account created for {inviteResult.name}
                      {inviteResult.smsSent && (
                        <span className="ml-2 text-green-400 font-semibold">· 📱 SMS sent!</span>
                      )}
                    </p>
                  </div>
                </div>
                <button onClick={() => setInviteResult(null)} className="text-slate-400 hover:text-white transition">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Invite Link</p>
                <div className="flex items-center gap-2 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2">
                  <code className="text-teal-300 text-xs flex-1 break-all">{inviteResult.url}</code>
                  <button onClick={() => navigator.clipboard.writeText(inviteResult.url)}
                    className="shrink-0 text-slate-400 hover:text-teal-300 transition" title="Copy link">
                    <Copy className="w-4 h-4" />
                  </button>
                  <a href={inviteResult.url} target="_blank" rel="noopener noreferrer"
                    className="shrink-0 text-slate-400 hover:text-teal-300 transition" title="Open link">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">SMS / Text Message</p>
                <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 relative">
                  <pre className="text-slate-300 text-xs whitespace-pre-wrap leading-relaxed font-sans">{inviteResult.sms}</pre>
                  <button onClick={() => navigator.clipboard.writeText(inviteResult.sms)}
                    className="absolute top-2 right-2 text-slate-500 hover:text-teal-300 transition" title="Copy SMS">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {inviteResult.smsSent ? (
                <div className="flex items-center justify-center gap-2 w-full bg-green-700/30 border border-green-600/40 text-green-300 font-semibold py-2.5 px-5 rounded-xl text-sm">
                  <CheckCircle className="w-4 h-4" />
                  SMS Sent to {inviteResult.name.split(' ')[0]} ✅
                </div>
              ) : inviteResult.phone ? (
                <a href={`sms:${inviteResult.phone}?body=${encodeURIComponent(inviteResult.sms)}`}
                  className="flex items-center justify-center gap-2 w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2.5 px-5 rounded-xl transition text-sm">
                  <Phone className="w-4 h-4" />
                  Open Text Message to {inviteResult.name.split(' ')[0]}
                </a>
              ) : null}
              <p className="text-slate-500 text-xs mt-3 text-center">
                {inviteResult.smsSent
                  ? 'SMS was automatically sent. Staff must click the link, sign the NDA, and set their own password.'
                  : 'Copy and send the link via text or email. Staff must click the link, sign the NDA, and set their own password.'}
              </p>
            </div>
          )}

          {/* ── Search + Filter ──────────────────────────────────────────── */}
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

          {/* ── Employee List ────────────────────────────────────────────── */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
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
                <button onClick={openAdd}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition">
                  <Plus className="w-4 h-4" /> Add Employee
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(m => {
                const roleInfo   = ROLES[m.role] || ROLES.other;
                const status     = getStatusBadge(m);
                const StatusIcon = status.icon;
                const initials   = m.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

                return (
                  <div key={m.id}
                    className="bg-slate-800 border border-slate-700 hover:border-blue-600/40 rounded-xl p-4 transition-all">
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${
                        m.is_active ? 'bg-blue-900/50 text-blue-300' : 'bg-slate-700 text-slate-500'
                      }`}>
                        {initials}
                      </div>

                      {/* Info — clickable to profile */}
                      <Link href={`/employees/${m.id}`} className="flex-1 min-w-0 group">
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
                      </Link>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => openEdit(m)}
                          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition" title="Edit">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button onClick={() => toggleActive(m)}
                          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition"
                          title={m.is_active ? 'Deactivate' : 'Activate'}>
                          {m.is_active
                            ? <ToggleRight className="w-4 h-4 text-green-400" />
                            : <ToggleLeft className="w-4 h-4" />}
                        </button>
                        <button onClick={() => deleteMember(m.id, m.full_name)}
                          className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <Link href={`/employees/${m.id}`}
                          className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-900/20 rounded-lg transition" title="View Profile">
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>

                    {/* Invite link row — shown if not yet active */}
                    {m.invite_token && m.invite_status !== 'active' && (
                      <div className="mt-3 pt-3 border-t border-slate-700 flex items-center gap-2">
                        <Briefcase className="w-3 h-3 text-teal-400 shrink-0" />
                        <code className="text-teal-300 text-[10px] flex-1 truncate">
                          {typeof window !== 'undefined'
                            ? `${window.location.origin}/staff/invite/${m.invite_token}`
                            : `https://roomlenspro.com/staff/invite/${m.invite_token}`}
                        </code>
                        <button
                          onClick={() => {
                            const link = `${window.location.origin}/staff/invite/${m.invite_token}`;
                            navigator.clipboard.writeText(link);
                          }}
                          className="text-slate-400 hover:text-teal-300 transition shrink-0" title="Copy invite link">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {m.cell_phone && (
                          <a
                            href={`sms:${m.cell_phone}?body=${encodeURIComponent(
                              `Hi ${m.full_name.split(' ')[0]}! Here is your RoomLens Pro invite link: ${window.location.origin}/staff/invite/${m.invite_token}`
                            )}`}
                            className="text-slate-400 hover:text-teal-300 transition shrink-0" title="Send via text">
                            <Send className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ── Suspense wrapper (required for useSearchParams in Next.js 14) ─────────────
export default function EmployeesPageWrapper() {
  return (
    <Suspense fallback={
      <div className="flex h-screen bg-slate-950 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    }>
      <EmployeesPage />
    </Suspense>
  );
}
