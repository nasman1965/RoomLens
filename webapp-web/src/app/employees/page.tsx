'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/hooks/usePermissions';
import { useCompanyContext } from '@/hooks/useCompanyContext';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import {
  Users, Search, Plus, Phone, Mail, ChevronRight,
  CheckCircle, Clock, Shield, AlertTriangle,
  User, UserCheck, X, Send, Copy, ExternalLink, Lock,
  Eye, EyeOff, Loader2, Edit3, ToggleLeft, ToggleRight,
  Trash2, Briefcase,
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

const BLANK = { full_name: '', role: 'tech', cell_phone: '', email: '', notes: '', temp_password: '' };
const INP = 'w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 outline-none transition';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

export default function EmployeesPage() {
  const router = useRouter();
  const { can } = usePermissions();
  const { ownerUserId, selfUserId, companyName: ctxCompanyName, loading: ctxLoading } = useCompanyContext();
  const canManage = can('add_employees');

  const [userId,      setUserId]      = useState('');
  const [company,     setCompany]     = useState('RoomLens Pro');
  const [members,     setMembers]     = useState<TeamMember[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [filter,      setFilter]      = useState<'all'|'active'|'invited'|'pending'>('all');

  // form state
  const [showForm,    setShowForm]    = useState(false);
  const [editId,      setEditId]      = useState<string|null>(null);
  const [form,        setForm]        = useState(BLANK);
  const [saving,      setSaving]      = useState(false);
  const [formErr,     setFormErr]     = useState('');
  const [formOk,      setFormOk]      = useState('');
  const [showPw,      setShowPw]      = useState(false);

  // invite result
  const [invite, setInvite] = useState<{
    url: string; sms: string; name: string; phone: string; smsSent?: boolean;
  } | null>(null);

  // load
  useEffect(() => {
    if (ctxLoading || !ownerUserId) return;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      // selfUserId for display purposes (the logged-in user's own id)
      setUserId(selfUserId || session.user.id);

      // Use company name from context (resolved correctly for both roles)
      setCompany(ctxCompanyName || 'RoomLens Pro');

      // Always load team_members using the owner's user_id
      await load(ownerUserId);
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxLoading, ownerUserId]);

  async function load(uid: string) {
    const { data } = await supabase
      .from('team_members')
      .select('id,full_name,role,cell_phone,email,is_active,notes,invite_status,nda_accepted,invite_token,created_at')
      .eq('user_id', uid)
      .order('full_name');
    setMembers(data || []);
  }

  function openAdd() {
    setEditId(null); setForm(BLANK); setFormErr(''); setFormOk('');
    setInvite(null); setShowPw(false); setShowForm(true);
    setTimeout(() => document.getElementById('empform')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }

  function openEdit(m: TeamMember) {
    setEditId(m.id);
    setForm({ full_name: m.full_name, role: m.role, cell_phone: m.cell_phone||'', email: m.email||'', notes: m.notes||'', temp_password: '' });
    setFormErr(''); setFormOk(''); setInvite(null); setShowPw(false); setShowForm(true);
    setTimeout(() => document.getElementById('empform')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim()) { setFormErr('Name is required.'); return; }
    if (!editId && !form.email.trim()) { setFormErr('Email is required for new invite.'); return; }
    if (!editId && !form.temp_password.trim()) { setFormErr('Temporary password is required.'); return; }
    setSaving(true); setFormErr(''); setFormOk('');
    try {
      if (editId) {
        const { error } = await supabase.from('team_members').update({
          full_name: form.full_name, role: form.role,
          cell_phone: form.cell_phone || null,
          email: form.email || null, notes: form.notes || null,
        }).eq('id', editId);
        if (error) { setFormErr(error.message); return; }
        setFormOk('Member updated.'); setShowForm(false); load(ownerUserId);
      } else {
        // Send everything to the API route — it handles users upsert +
        // team_members insert + auth user creation with service role key
        // (avoids FK violation from client-side insert)
        const res = await fetch('/api/staff/invite', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: form.email,
            full_name: form.full_name,
            role: form.role,
            cell_phone: form.cell_phone || null,
            notes: form.notes || null,
            temp_password: form.temp_password,
            company_name: company,
            admin_user_id: ownerUserId,  // ← always the company_admin's id
          }),
        });
        const r = await res.json();
        if (r.success) {
          setInvite({ url: r.invite_url, sms: r.sms_message, name: form.full_name, phone: form.cell_phone||'', smsSent: r.sms_sent||false });
          setShowForm(false); load(ownerUserId);
        } else { setFormErr(r.error || 'Invite failed.'); }
      }
    } catch (err: unknown) {
      setFormErr('Error: ' + (err instanceof Error ? err.message : String(err)));
    } finally { setSaving(false); }
  }

  async function toggle(m: TeamMember) {
    await supabase.from('team_members').update({ is_active: !m.is_active }).eq('id', m.id);
    load(ownerUserId);
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    await supabase.from('team_members').delete().eq('id', id);
    load(ownerUserId);
  }

  // derived
  const filtered = members.filter(m => {
    const ms = !search || m.full_name.toLowerCase().includes(search.toLowerCase())
      || (m.email||'').toLowerCase().includes(search.toLowerCase())
      || m.role.toLowerCase().includes(search.toLowerCase());
    const fs =
      filter === 'active'  ? !!(m.nda_accepted && m.invite_status === 'active') :
      filter === 'invited' ? m.invite_status === 'invited' :
      filter === 'pending' ? (!m.invite_status || m.invite_status === 'pending') : true;
    return ms && fs;
  });

  const nActive  = members.filter(m => m.nda_accepted && m.invite_status === 'active').length;
  const nInvited = members.filter(m => m.invite_status === 'invited').length;
  const nPending = members.filter(m => !m.invite_status || m.invite_status === 'pending').length;

  function badge(m: TeamMember) {
    if (m.nda_accepted && m.invite_status === 'active')
      return { label: 'Active',      cls: 'bg-green-900/60 text-green-300 border-green-700/40',   Icon: CheckCircle };
    if (m.invite_status === 'invited')
      return { label: 'Invite Sent', cls: 'bg-yellow-900/60 text-yellow-300 border-yellow-700/40', Icon: Clock };
    if (m.invite_status === 'suspended')
      return { label: 'Suspended',   cls: 'bg-red-900/60 text-red-300 border-red-700/40',          Icon: AlertTriangle };
    return   { label: 'Not Invited', cls: 'bg-slate-700/60 text-slate-400 border-slate-600/40',    Icon: User };
  }

  return (
    <div className="flex bg-slate-950 min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0 pb-20 lg:pb-0">

        {/* Header */}
        <div className="bg-slate-900 border-b border-slate-700 px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-blue-400 text-xs font-semibold uppercase tracking-widest mb-0.5">Team Management</p>
              <h1 className="text-white font-bold text-xl flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400 shrink-0" /> Employees
              </h1>
              <p className="text-slate-400 text-xs mt-0.5">{members.length} team member{members.length !== 1 ? 's' : ''}</p>
            </div>
            {canManage && (
              <button onClick={openAdd}
                className="flex items-center gap-1.5 bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-semibold px-3 py-2 rounded-lg transition shrink-0">
                <Plus className="w-3.5 h-3.5" /> Add Employee
              </button>
            )}
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-4">

          {/* Stats — 3 cols but compact on mobile */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {[
              { label: 'Active',   value: nActive,  color: 'text-green-400',  bg: 'bg-green-900/20 border-green-700/30',  Icon: UserCheck },
              { label: 'Invited',  value: nInvited, color: 'text-yellow-400', bg: 'bg-yellow-900/20 border-yellow-700/30', Icon: Clock },
              { label: 'Pending',  value: nPending, color: 'text-slate-400',  bg: 'bg-slate-800/60 border-slate-700',      Icon: User },
            ].map(s => (
              <div key={s.label} className={`${s.bg} border rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row items-center sm:items-start gap-1 sm:gap-3 text-center sm:text-left`}>
                <s.Icon className={`w-5 h-5 ${s.color} shrink-0`} />
                <div>
                  <p className={`text-xl sm:text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-slate-400 text-[10px] sm:text-xs leading-tight">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Success msg */}
          {formOk && (
            <div className="flex items-center gap-2 bg-green-900/30 border border-green-700/40 text-green-300 rounded-lg px-4 py-3 text-sm">
              <CheckCircle className="w-4 h-4" /> {formOk}
            </div>
          )}

          {/* Add/Edit Form — company_admin only */}
          {showForm && canManage && (
            <div id="empform" className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold text-sm">{editId ? 'Edit Employee' : 'Add Employee & Send Invite'}</h3>
                <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-slate-400 hover:text-white" /></button>
              </div>
              {formErr && (
                <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/40 text-red-300 rounded-lg px-4 py-3 text-sm mb-3">
                  <AlertTriangle className="w-4 h-4" /> {formErr}
                </div>
              )}
              <form onSubmit={save} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Full Name *">
                    <input type="text" value={form.full_name}
                      onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
                      placeholder="Jane Doe" className={INP} required />
                  </Field>
                  <Field label="Role">
                    <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} className={INP}>
                      {Object.entries(ROLES).map(([v, r]) => <option key={v} value={v}>{r.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Cell Phone">
                    <input type="tel" value={form.cell_phone}
                      onChange={e => setForm(p => ({ ...p, cell_phone: e.target.value }))}
                      placeholder="(555) 123-4567" className={INP} />
                  </Field>
                  <Field label={editId ? 'Email' : 'Email *'}>
                    <input type="email" value={form.email}
                      onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                      placeholder="jane@company.com" className={INP} />
                  </Field>
                </div>
                <Field label="Notes">
                  <input type="text" value={form.notes}
                    onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Optional notes" className={INP} />
                </Field>

                {!editId && (
                  <div className="bg-teal-900/20 border border-teal-700/40 rounded-xl p-4">
                    <p className="text-teal-300 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" /> Staff Login Setup
                    </p>
                    <p className="text-slate-400 text-xs mb-3">
                      Create a temporary password. Staff will use this to access the invite link and set their own password during onboarding.
                    </p>
                    <Field label="Temporary Password *">
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type={showPw ? 'text' : 'password'}
                          value={form.temp_password}
                          onChange={e => setForm(p => ({ ...p, temp_password: e.target.value }))}
                          placeholder="Min. 8 characters (e.g. Staff2026!)"
                          className="w-full pl-10 pr-10 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-400 focus:ring-2 focus:ring-teal-500 outline-none"
                          required
                        />
                        <button type="button" onClick={() => setShowPw(!showPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                          {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </Field>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button type="submit" disabled={saving}
                    className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-white font-semibold py-2 px-5 rounded-lg text-sm transition">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {editId ? 'Update Member' : 'Create & Send Invite'}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)}
                    className="py-2 px-5 rounded-lg text-sm text-slate-400 hover:text-white border border-slate-600 transition">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Invite Result */}
          {invite && (
            <div className="bg-teal-900/20 border border-teal-600/40 rounded-2xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-bold">Invite Created!</p>
                    <p className="text-teal-300 text-xs">
                      Account created for {invite.name}
                      {invite.smsSent && <span className="ml-2 text-green-400 font-semibold">· 📱 SMS sent!</span>}
                    </p>
                  </div>
                </div>
                <button onClick={() => setInvite(null)}><X className="w-5 h-5 text-slate-400 hover:text-white" /></button>
              </div>

              <div className="mb-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Invite Link</p>
                <div className="flex items-center gap-2 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2">
                  <code className="text-teal-300 text-xs flex-1 break-all">{invite.url}</code>
                  <button onClick={() => navigator.clipboard.writeText(invite.url)}
                    className="text-slate-400 hover:text-teal-300 shrink-0" title="Copy">
                    <Copy className="w-4 h-4" />
                  </button>
                  <a href={invite.url} target="_blank" rel="noopener noreferrer"
                    className="text-slate-400 hover:text-teal-300 shrink-0">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">SMS / Text Message</p>
                <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 relative">
                  <pre className="text-slate-300 text-xs whitespace-pre-wrap font-sans">{invite.sms}</pre>
                  <button onClick={() => navigator.clipboard.writeText(invite.sms)}
                    className="absolute top-2 right-2 text-slate-500 hover:text-teal-300">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {invite.smsSent ? (
                <div className="flex items-center justify-center gap-2 w-full bg-green-700/30 border border-green-600/40 text-green-300 font-semibold py-2.5 rounded-xl text-sm">
                  <CheckCircle className="w-4 h-4" /> SMS Sent to {invite.name.split(' ')[0]} ✅
                </div>
              ) : invite.phone ? (
                <a href={`sms:${invite.phone}?body=${encodeURIComponent(invite.sms)}`}
                  className="flex items-center justify-center gap-2 w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2.5 rounded-xl text-sm transition">
                  <Phone className="w-4 h-4" /> Open Text to {invite.name.split(' ')[0]}
                </a>
              ) : null}
            </div>
          )}

          {/* Search + Filter */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search name, email or role..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div className="flex gap-2 flex-wrap">
              {(['all','active','invited','pending'] as const).map(s => (
                <button key={s} onClick={() => setFilter(s)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold capitalize transition ${
                    filter === s ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                  }`}>
                  {s === 'all' ? `All (${members.length})` : s}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          {loading || ctxLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-20 bg-slate-800/50 rounded-xl animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-12 text-center">
              <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-white font-semibold mb-1">
                {search || filter !== 'all' ? 'No employees match your filter' : 'No employees yet'}
              </p>
              <p className="text-slate-500 text-sm mb-4">
                {search || filter !== 'all' ? 'Try a different search or filter' : 'Add your first team member to get started'}
              </p>
              {!search && filter === 'all' && canManage && (
                <button onClick={openAdd}
                  className="inline-flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition">
                  <Plus className="w-4 h-4" /> Add Employee
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(m => {
                const role = ROLES[m.role] || ROLES.other;
                const { label, cls, Icon } = badge(m);
                const initials = m.full_name.split(' ').map((w: string) => w[0]).slice(0,2).join('').toUpperCase();
                const inviteLink = m.invite_token
                  ? `${typeof window !== 'undefined' ? window.location.origin : 'https://roomlenspro.com'}/staff/invite/${m.invite_token}`
                  : null;

                return (
                  <div key={m.id} className="bg-slate-800 border border-slate-700 hover:border-blue-600/40 rounded-xl p-4 transition-all">
                    <div className="flex items-center gap-4">

                      {/* Avatar */}
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${
                        m.is_active ? 'bg-blue-900/50 text-blue-300' : 'bg-slate-700 text-slate-500'
                      }`}>
                        {initials}
                      </div>

                      {/* Name + badges — links to profile */}
                      <Link href={`/employees/${m.id}`} className="flex-1 min-w-0 group">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-white font-semibold text-sm group-hover:text-blue-300 transition">{m.full_name}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${role.color}`}>{role.label}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${cls}`}>
                            <Icon className="w-2.5 h-2.5" />{label}
                          </span>
                          {m.nda_accepted && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-900/60 text-teal-400 flex items-center gap-1">
                              <Shield className="w-2.5 h-2.5" /> NDA ✓
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 flex-wrap">
                          {m.cell_phone && <span className="flex items-center gap-1 text-xs text-slate-400"><Phone className="w-3 h-3" />{m.cell_phone}</span>}
                          {m.email && <span className="flex items-center gap-1 text-xs text-slate-400 truncate"><Mail className="w-3 h-3" />{m.email}</span>}
                        </div>
                      </Link>

                      {/* Actions — company_admin only */}
                      <div className="flex items-center gap-1 shrink-0">
                        {canManage && (
                        <button onClick={() => openEdit(m)}
                          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition" title="Edit">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        )}
                        <button onClick={() => toggle(m)}
                          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition"
                          title={m.is_active ? 'Deactivate' : 'Activate'}>
                          {m.is_active
                            ? <ToggleRight className="w-4 h-4 text-green-400" />
                            : <ToggleLeft className="w-4 h-4" />}
                        </button>
                        <button onClick={() => remove(m.id, m.full_name)}
                          className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <Link href={`/employees/${m.id}`}
                          className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-900/20 rounded-lg transition">
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>

                    {/* Invite link row */}
                    {inviteLink && m.invite_status !== 'active' && (
                      <div className="mt-3 pt-3 border-t border-slate-700 flex items-center gap-2">
                        <Briefcase className="w-3 h-3 text-teal-400 shrink-0" />
                        <code className="text-teal-300 text-[10px] flex-1 truncate">{inviteLink}</code>
                        <button onClick={() => navigator.clipboard.writeText(inviteLink)}
                          className="text-slate-400 hover:text-teal-300 shrink-0" title="Copy invite link">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {m.cell_phone && (
                          <a href={`sms:${m.cell_phone}?body=${encodeURIComponent(`Hi ${m.full_name.split(' ')[0]}! Here is your RoomLens Pro invite: ${inviteLink}`)}`}
                            className="text-slate-400 hover:text-teal-300 shrink-0">
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
