'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  User, Building2, Mail, Save, Loader2, CheckCircle, AlertCircle,
  Users, Plus, Phone, Trash2, Edit3, X, Shield, Bell, CreditCard,
  Plug, Key, Eye, EyeOff, ToggleLeft, ToggleRight,
  ChevronRight, Zap, Globe, BarChart2, FileText, Clock,
  Send, Copy, ExternalLink, Lock,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Profile {
  id: string; email: string; full_name: string | null;
  company_name: string | null; role: string; subscription_tier: string;
}
interface TeamMember {
  id: string; full_name: string; role: string;
  cell_phone: string | null; email: string | null;
  is_active: boolean; notes: string | null; created_at: string;
  invite_status: string | null; nda_accepted: boolean | null;
  invite_token: string | null;
}

type Tab = 'profile' | 'team' | 'billing' | 'notifications' | 'security' | 'apps';

// ─── Constants ─────────────────────────────────────────────────────────────────
const ROLES: Record<string, { label: string; color: string }> = {
  admin:         { label: 'Admin',         color: 'bg-purple-900/60 text-purple-300' },
  office:        { label: 'Office',        color: 'bg-blue-900/60 text-blue-300'    },
  estimator:     { label: 'Estimator',     color: 'bg-cyan-900/60 text-cyan-300'    },
  lead_tech:     { label: 'Lead Tech',     color: 'bg-green-900/60 text-green-300'  },
  tech:          { label: 'Technician',    color: 'bg-teal-900/60 text-teal-300'    },
  subcontractor: { label: 'Subcontractor', color: 'bg-orange-900/60 text-orange-300'},
  other:         { label: 'Other',         color: 'bg-slate-700 text-slate-300'      },
};

const BLANK_MEMBER = { full_name: '', role: 'tech', cell_phone: '', email: '', notes: '', temp_password: '' };

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'profile',       label: 'Profile',        icon: <User className="w-4 h-4" /> },
  { id: 'team',          label: 'Team Members',   icon: <Users className="w-4 h-4" /> },
  { id: 'billing',       label: 'Plan & Billing', icon: <CreditCard className="w-4 h-4" /> },
  { id: 'notifications', label: 'Notifications',  icon: <Bell className="w-4 h-4" /> },
  { id: 'security',      label: 'Security',       icon: <Shield className="w-4 h-4" /> },
  { id: 'apps',          label: 'Connected Apps', icon: <Plug className="w-4 h-4" /> },
];

const INTEGRATIONS = [
  {
    id: 'clockinproof',
    name: 'ClockInProof',
    description: 'GPS-verified time tracking. Auto clock-in techs when they arrive on site.',
    icon: <Clock className="w-6 h-6" />,
    color: 'text-emerald-400',
    bg: 'bg-emerald-900/30',
    status: 'coming_soon',
    docsUrl: 'https://www.clockinproof.com',
  },
  {
    id: 'encircle',
    name: 'Encircle',
    description: 'Field documentation and contents inventory for restoration projects.',
    icon: <FileText className="w-6 h-6" />,
    color: 'text-blue-400',
    bg: 'bg-blue-900/30',
    status: 'available',
    docsUrl: 'https://help.encircleapp.com/hc/en-us/articles/12036459891853',
  },
  {
    id: 'xactimate',
    name: 'Xactimate (Verisk)',
    description: 'Industry-standard property damage estimating software.',
    icon: <BarChart2 className="w-6 h-6" />,
    color: 'text-purple-400',
    bg: 'bg-purple-900/30',
    status: 'apply_required',
    docsUrl: 'https://www.verisk.com/company/strategic-alliances/partner-application/',
  },
  {
    id: 'xactanalysis',
    name: 'XactAnalysis',
    description: 'Claims analytics and reporting from Verisk.',
    icon: <BarChart2 className="w-6 h-6" />,
    color: 'text-indigo-400',
    bg: 'bg-indigo-900/30',
    status: 'apply_required',
    docsUrl: 'https://www.verisk.com/products/xactimate/',
  },
  {
    id: 'xactimate_online',
    name: 'Xactimate Online',
    description: 'Browser-based property estimating — no desktop install needed.',
    icon: <Globe className="w-6 h-6" />,
    color: 'text-cyan-400',
    bg: 'bg-cyan-900/30',
    status: 'apply_required',
    docsUrl: 'https://www.verisk.com/products/xactimate/',
  },
  {
    id: 'restoration_manager',
    name: 'Restoration Manager',
    description: 'Verisk job management workflow tool for restoration companies.',
    icon: <Zap className="w-6 h-6" />,
    color: 'text-yellow-400',
    bg: 'bg-yellow-900/30',
    status: 'apply_required',
    docsUrl: 'https://www.verisk.com/products/restoration-manager/',
  },
];

// ─── Shared input style ─────────────────────────────────────────────────────────
const input = 'w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition';

// ═══════════════════════════════════════════════════════════════════════════════
function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>('profile');

  // Profile
  const [profile, setProfile]         = useState<Profile | null>(null);
  const [fullName, setFullName]       = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile,  setSavingProfile]  = useState(false);
  const [profileOk,  setProfileOk]  = useState(false);
  const [profileErr, setProfileErr] = useState('');
  const [userId, setUserId] = useState('');

  // Team
  const [members,      setMembers]     = useState<TeamMember[]>([]);
  const [loadingTeam,  setLoadingTeam] = useState(false);
  const [showForm,     setShowForm]    = useState(false);
  const [editId,       setEditId]      = useState<string | null>(null);
  const [memberForm,   setMemberForm]  = useState(BLANK_MEMBER);
  const [savingMember, setSavingMember]= useState(false);
  const [memberOk,     setMemberOk]   = useState('');
  const [memberErr,    setMemberErr]  = useState('');
  const [showTempPw,   setShowTempPw] = useState(false);
  const [inviteResult, setInviteResult] = useState<{
    url: string; sms: string; name: string; phone: string;
  } | null>(null);

  // Notifications
  const [notifs, setNotifs] = useState({
    emailNewJob: true, emailStepComplete: true, emailReportsDue: false,
    emailEquipment: true, pushNewJob: false, pushStepComplete: false,
  });
  const [savingNotifs, setSavingNotifs] = useState(false);
  const [notifsOk, setNotifsOk] = useState(false);

  // Security
  const [currentPw, setCurrentPw]   = useState('');
  const [newPw, setNewPw]           = useState('');
  const [confirmPw, setConfirmPw]   = useState('');
  const [showPw, setShowPw]         = useState(false);
  const [savingPw, setSavingPw]     = useState(false);
  const [pwOk, setPwOk]             = useState(false);
  const [pwErr, setPwErr]           = useState('');

  // Apps / Integrations
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [savingKey, setSavingKey] = useState('');

  // ── URL param ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = searchParams.get('tab') as Tab | null;
    if (t && TABS.find(x => x.id === t)) setTab(t);
  }, [searchParams]);

  // ── Auth + profile ───────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setUserId(session.user.id);
      const { data: rec } = await supabase.from('users').select('*').eq('id', session.user.id).single();
      if (rec) {
        setProfile(rec);
        setFullName(rec.full_name || '');
        setCompanyName(rec.company_name || '');
      } else {
        setProfile({ id: session.user.id, email: session.user.email!, full_name: '', company_name: '', role: 'admin', subscription_tier: 'free' });
        setFullName(session.user.user_metadata?.full_name || '');
        setCompanyName('');
      }
      setLoadingProfile(false);
    })();
  }, [router]);

  // ── Team lazy load ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (tab === 'team' && userId) fetchTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, userId]);

  const fetchTeam = async () => {
    setLoadingTeam(true);
    const { data } = await supabase.from('team_members')
      .select('id, full_name, role, cell_phone, email, is_active, notes, created_at, invite_status, nda_accepted, invite_token')
      .eq('user_id', userId).order('is_active', { ascending: false }).order('full_name');
    setMembers(data || []);
    setLoadingTeam(false);
  };

  // ── Save profile ─────────────────────────────────────────────────────────────
  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true); setProfileErr(''); setProfileOk(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { error } = await supabase.from('users').upsert({
        id: session.user.id, email: session.user.email!,
        full_name: fullName, company_name: companyName,
        role: profile?.role || 'admin',
        subscription_tier: profile?.subscription_tier || 'free',
        updated_at: new Date().toISOString(),
      });
      if (error) setProfileErr(error.message);
      else { setProfileOk(true); setTimeout(() => setProfileOk(false), 3000); }
    } catch { setProfileErr('Save failed. Please try again.'); }
    finally { setSavingProfile(false); }
  };

  // ── Team CRUD ────────────────────────────────────────────────────────────────
  const openAdd  = () => { setEditId(null); setMemberForm(BLANK_MEMBER); setMemberErr(''); setMemberOk(''); setShowForm(true); };
  const openEdit = (m: TeamMember) => {
    setEditId(m.id);
    setMemberForm({ full_name: m.full_name, role: m.role, cell_phone: m.cell_phone || '', email: m.email || '', notes: m.notes || '' });
    setMemberErr(''); setMemberOk('');
    setShowForm(true);
  };
  const saveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberForm.full_name.trim()) { setMemberErr('Name is required.'); return; }
    if (!editId && !memberForm.email?.trim()) { setMemberErr('Email is required to send invite.'); return; }
    if (!editId && !memberForm.temp_password?.trim()) { setMemberErr('Temp password is required.'); return; }
    setSavingMember(true); setMemberErr(''); setMemberOk('');
    try {
      let memberId = editId;
      if (editId) {
        const { error } = await supabase.from('team_members').update({
          full_name: memberForm.full_name, role: memberForm.role,
          cell_phone: memberForm.cell_phone || null,
          email: memberForm.email || null, notes: memberForm.notes || null,
        }).eq('id', editId);
        if (error) { setMemberErr(error.message); return; }
        setMemberOk('Member updated.'); setShowForm(false); fetchTeam();
      } else {
        // Insert new member
        const { data: newMember, error: insertError } = await supabase
          .from('team_members')
          .insert({ ...memberForm, user_id: userId, is_active: true })
          .select('id').single();
        if (insertError || !newMember) { setMemberErr(insertError?.message || 'Insert failed.'); return; }
        memberId = newMember.id;

        // Send invite via API
        const res = await fetch('/api/staff/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            member_id: memberId,
            email: memberForm.email,
            full_name: memberForm.full_name,
            temp_password: memberForm.temp_password,
            company_name: profile?.company_name || 'RoomLens Pro',
            admin_user_id: userId,
          }),
        });
        const result = await res.json();
        if (result.success) {
          // Show invite link + SMS copy
          setInviteResult({
            url: result.invite_url,
            sms: result.sms_message,
            name: memberForm.full_name,
            phone: memberForm.cell_phone || '',
          });
          setMemberOk('');
          setShowForm(false);
          fetchTeam();
        } else {
          setMemberErr(result.error || 'Invite failed.');
        }
      }
    } catch (err: any) { setMemberErr('Save failed: ' + err.message); }
    finally { setSavingMember(false); }
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

  // ── Change password ──────────────────────────────────────────────────────────
  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwErr(''); setPwOk(false);
    if (!newPw || newPw.length < 8) { setPwErr('New password must be at least 8 characters.'); return; }
    if (newPw !== confirmPw) { setPwErr('Passwords do not match.'); return; }
    setSavingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) setPwErr(error.message);
      else { setPwOk(true); setCurrentPw(''); setNewPw(''); setConfirmPw(''); setTimeout(() => setPwOk(false), 3000); }
    } catch { setPwErr('Password update failed.'); }
    finally { setSavingPw(false); }
  };

  // ── Save notifications ───────────────────────────────────────────────────────
  const saveNotifications = async () => {
    setSavingNotifs(true);
    await new Promise(r => setTimeout(r, 600)); // simulate save
    setSavingNotifs(false); setNotifsOk(true); setTimeout(() => setNotifsOk(false), 2500);
  };

  // ── Connect integration ──────────────────────────────────────────────────────
  const connectApp = async (id: string) => {
    if (!apiKeys[id]?.trim()) return;
    setSavingKey(id);
    await new Promise(r => setTimeout(r, 800)); // future: real API call
    setConnected(p => ({ ...p, [id]: true }));
    setSavingKey('');
  };
  const disconnectApp = (id: string) => {
    setConnected(p => ({ ...p, [id]: false }));
    setApiKeys(p => ({ ...p, [id]: '' }));
  };

  // ─── Loading splash ──────────────────────────────────────────────────────────
  if (loadingProfile) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full min-h-screen bg-slate-900">

      {/* ── Left sidebar ── */}
      <aside className="w-56 shrink-0 bg-slate-800/60 border-r border-slate-700 flex flex-col pt-6">
        <p className="px-5 text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3">Settings</p>
        <nav className="flex-1">
          {TABS.map(t => (
            <button key={t.id} type="button"
              onClick={() => setTab(t.id)}
              className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition text-left ${
                tab === t.id
                  ? 'bg-blue-600/20 text-blue-300 border-r-2 border-blue-500'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}>
              {t.icon}
              {t.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto p-8 max-w-3xl">

        {/* ══════ PROFILE ══════ */}
        {tab === 'profile' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Profile</h1>
              <p className="text-slate-400 text-sm mt-1">Manage your account information</p>
            </div>

            {/* Plan badge */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Current Plan</p>
                <span className="inline-block bg-blue-900/60 text-blue-300 text-xs font-bold px-3 py-1 rounded-full capitalize">
                  {profile?.subscription_tier || 'Free'}
                </span>
                <span className="text-xs text-slate-500 ml-3 capitalize">{profile?.role} access</span>
              </div>
              <button type="button" onClick={() => setTab('billing')}
                className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 font-medium transition">
                Upgrade Plan <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <h2 className="text-base font-semibold text-white mb-5 flex items-center gap-2">
                <User className="w-4 h-4 text-blue-400" /> Profile Information
              </h2>
              {profileErr && <Alert type="error" msg={profileErr} />}
              {profileOk  && <Alert type="success" msg="Profile saved successfully!" />}
              <form onSubmit={saveProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Email">
                    <input type="email" value={profile?.email || ''} disabled
                      className="w-full px-3 py-2.5 bg-slate-700/30 border border-slate-600 rounded-lg text-sm text-slate-400 cursor-not-allowed" />
                  </Field>
                  <Field label="Role">
                    <input type="text" value={profile?.role || 'admin'} disabled
                      className="w-full px-3 py-2.5 bg-slate-700/30 border border-slate-600 rounded-lg text-sm text-slate-400 cursor-not-allowed capitalize" />
                  </Field>
                </div>
                <Field label="Full Name">
                  <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                    placeholder="John Smith" className={input} />
                </Field>
                <Field label="Company Name">
                  <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)}
                    placeholder="Smith Restoration Inc." className={input} />
                </Field>
                <button type="submit" disabled={savingProfile}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-semibold py-2.5 px-6 rounded-lg transition text-sm">
                  {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Profile
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ══════ TEAM MEMBERS ══════ */}
        {tab === 'team' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white">Team Members</h1>
                <p className="text-slate-400 text-sm mt-1">Employees who can be assigned to jobs</p>
              </div>
              <button type="button" onClick={openAdd}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition">
                <Plus className="w-4 h-4" /> Add Employee
              </button>
            </div>

            {memberOk && <Alert type="success" msg={memberOk} />}

            {/* Add / Edit form */}
            {showForm && (
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white">{editId ? 'Edit Employee' : 'Add Employee'}</h3>
                  <button type="button" onClick={() => setShowForm(false)}><X className="w-4 h-4 text-slate-400 hover:text-white" /></button>
                </div>
                {memberErr && <Alert type="error" msg={memberErr} />}
                <form onSubmit={saveMember} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Full Name *">
                      <input type="text" value={memberForm.full_name} onChange={e => setMemberForm(p => ({ ...p, full_name: e.target.value }))}
                        placeholder="Jane Doe" className={input} required />
                    </Field>
                    <Field label="Role">
                      <select value={memberForm.role} onChange={e => setMemberForm(p => ({ ...p, role: e.target.value }))}
                        className={input}>
                        {Object.entries(ROLES).map(([v, r]) => <option key={v} value={v}>{r.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Cell Phone">
                      <input type="tel" value={memberForm.cell_phone} onChange={e => setMemberForm(p => ({ ...p, cell_phone: e.target.value }))}
                        placeholder="(555) 123-4567" className={input} />
                    </Field>
                    <Field label="Email">
                      <input type="email" value={memberForm.email} onChange={e => setMemberForm(p => ({ ...p, email: e.target.value }))}
                        placeholder="jane@company.com" className={input} />
                    </Field>
                  </div>
                  <Field label="Notes">
                    <input type="text" value={memberForm.notes} onChange={e => setMemberForm(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Optional notes" className={input} />
                  </Field>

                  {/* Temp password — only shown when adding new member */}
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
                            required={!editId}
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

            {/* ── Invite Result Modal ─────────────────────────────────── */}
            {inviteResult && (
              <div className="bg-teal-900/20 border border-teal-600/40 rounded-2xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-bold text-base">Invite Created!</p>
                      <p className="text-teal-300 text-xs">Account created for {inviteResult.name}</p>
                    </div>
                  </div>
                  <button onClick={() => setInviteResult(null)} className="text-slate-400 hover:text-white transition">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Invite Link */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Invite Link</p>
                  <div className="flex items-center gap-2 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2">
                    <code className="text-teal-300 text-xs flex-1 break-all">{inviteResult.url}</code>
                    <button
                      onClick={() => { navigator.clipboard.writeText(inviteResult.url); }}
                      className="shrink-0 text-slate-400 hover:text-teal-300 transition" title="Copy link">
                      <Copy className="w-4 h-4" />
                    </button>
                    <a href={inviteResult.url} target="_blank" rel="noopener noreferrer"
                      className="shrink-0 text-slate-400 hover:text-teal-300 transition" title="Open link">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                {/* SMS Message */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">SMS / Text Message</p>
                  <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 relative">
                    <pre className="text-slate-300 text-xs whitespace-pre-wrap leading-relaxed font-sans">{inviteResult.sms}</pre>
                    <button
                      onClick={() => navigator.clipboard.writeText(inviteResult.sms)}
                      className="absolute top-2 right-2 text-slate-500 hover:text-teal-300 transition" title="Copy SMS">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Send via SMS link if phone available */}
                {inviteResult.phone && (
                  <a
                    href={`sms:${inviteResult.phone}?body=${encodeURIComponent(inviteResult.sms)}`}
                    className="flex items-center justify-center gap-2 w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2.5 px-5 rounded-xl transition text-sm">
                    <Phone className="w-4 h-4" />
                    Open Text Message to {inviteResult.name.split(' ')[0]}
                  </a>
                )}
                <p className="text-slate-500 text-xs mt-3 text-center">
                  Copy and send the link via text or email. Staff must click the link, sign the NDA, and set their own password.
                </p>
              </div>
            )}

            {/* Member list */}
            {loadingTeam ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-blue-400" /></div>
            ) : members.length === 0 ? (
              <div className="bg-slate-800 rounded-xl border border-dashed border-slate-600 p-12 text-center">
                <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 font-medium">No team members yet</p>
                <p className="text-slate-500 text-sm mt-1">Add employees to enable dropdowns in job creation</p>
                <button type="button" onClick={openAdd}
                  className="mt-4 inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
                  <Plus className="w-4 h-4" /> Add First Employee
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {members.filter(m => m.is_active).map(m => (
                  <MemberCard key={m.id} m={m} onEdit={openEdit} onToggle={toggleActive} onDelete={deleteMember} />
                ))}
                {members.filter(m => !m.is_active).length > 0 && (
                  <>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider pt-3 pb-1">Inactive</p>
                    {members.filter(m => !m.is_active).map(m => (
                      <MemberCard key={m.id} m={m} onEdit={openEdit} onToggle={toggleActive} onDelete={deleteMember} />
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══════ PLAN & BILLING ══════ */}
        {tab === 'billing' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Plan & Billing</h1>
              <p className="text-slate-400 text-sm mt-1">Manage your subscription</p>
            </div>

            {/* Current plan card */}
            <div className="bg-gradient-to-br from-blue-900/40 to-slate-800 rounded-xl border border-blue-700/40 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Current Plan</p>
                  <h3 className="text-2xl font-bold text-white capitalize">{profile?.subscription_tier || 'Free'}</h3>
                  <p className="text-slate-400 text-sm mt-2">
                    {profile?.subscription_tier === 'free' ? 'Up to 5 jobs, 1 user, 1 GB storage' :
                     profile?.subscription_tier === 'starter' ? 'Up to 25 jobs, 3 users, 10 GB storage' :
                     profile?.subscription_tier === 'pro' ? 'Unlimited jobs, 10 users, 50 GB storage' :
                     'Unlimited everything, priority support'}
                  </p>
                  <p className="text-slate-500 text-xs mt-3">
                    {profile?.subscription_tier === 'free' ? 'No credit card required' : 'Next billing date: April 1, 2026'}
                  </p>
                </div>
                <span className="bg-blue-600/30 text-blue-300 text-xs font-bold px-3 py-1 rounded-full capitalize">
                  {profile?.subscription_tier || 'Free'}
                </span>
              </div>
            </div>

            {/* Plans */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { tier: 'starter', price: '$49', desc: '25 jobs · 3 users · 10 GB', highlight: false },
                { tier: 'pro',     price: '$99', desc: 'Unlimited · 10 users · 50 GB', highlight: true },
                { tier: 'enterprise', price: '$199', desc: 'Unlimited · 25 users · 200 GB', highlight: false },
              ].map(p => (
                <div key={p.tier} className={`rounded-xl border p-5 ${p.highlight ? 'border-blue-500 bg-blue-900/20' : 'border-slate-700 bg-slate-800'}`}>
                  {p.highlight && <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Most Popular</span>}
                  <h4 className="text-base font-bold text-white capitalize mt-1">{p.tier}</h4>
                  <p className="text-2xl font-bold text-white mt-1">{p.price}<span className="text-slate-400 text-sm font-normal">/mo</span></p>
                  <p className="text-slate-400 text-xs mt-2 mb-4">{p.desc}</p>
                  <button type="button"
                    className={`w-full py-2 rounded-lg text-sm font-semibold transition ${p.highlight ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'border border-slate-600 text-slate-300 hover:border-slate-500 hover:text-white'}`}>
                    {profile?.subscription_tier === p.tier ? 'Current Plan' : 'Upgrade'}
                  </button>
                </div>
              ))}
            </div>

            {/* Add-ons */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Plug className="w-4 h-4 text-blue-400" /> Add-ons
              </h3>
              {[
                { name: 'ClockInProof Integration', price: '+$29/mo', desc: 'GPS time tracking per job', icon: '🕐' },
                { name: 'Encircle Integration',     price: '+$19/mo', desc: 'Field documentation sync', icon: '📷' },
                { name: 'Floor Plans (LiDAR)',       price: '+$39/mo', desc: 'Auto-generate floor plans', icon: '🏗️' },
              ].map(addon => (
                <div key={addon.name} className="flex items-center justify-between py-3 border-b border-slate-700 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{addon.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-white">{addon.name}</p>
                      <p className="text-xs text-slate-400">{addon.desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-300">{addon.price}</span>
                    <button type="button" className="text-xs bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-700/40 px-3 py-1.5 rounded-lg transition font-semibold">
                      Add
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════ NOTIFICATIONS ══════ */}
        {tab === 'notifications' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Notifications</h1>
              <p className="text-slate-400 text-sm mt-1">Choose what you want to be notified about</p>
            </div>
            {notifsOk && <Alert type="success" msg="Notification preferences saved!" />}

            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Mail className="w-3.5 h-3.5" /> Email Notifications
              </p>
              <Toggle label="New job assignment" sub="When a job is assigned to you" checked={notifs.emailNewJob} onChange={v => setNotifs(p => ({ ...p, emailNewJob: v }))} />
              <Toggle label="Step completed" sub="When a workflow step is marked complete" checked={notifs.emailStepComplete} onChange={v => setNotifs(p => ({ ...p, emailStepComplete: v }))} />
              <Toggle label="Reports due" sub="Reminder when 24-hr report is due" checked={notifs.emailReportsDue} onChange={v => setNotifs(p => ({ ...p, emailReportsDue: v }))} />
              <Toggle label="Equipment alerts" sub="Low battery or dehumidifier issues" checked={notifs.emailEquipment} onChange={v => setNotifs(p => ({ ...p, emailEquipment: v }))} />
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Bell className="w-3.5 h-3.5" /> Push Notifications
              </p>
              <Toggle label="New job assigned" sub="Instant alert on your device" checked={notifs.pushNewJob} onChange={v => setNotifs(p => ({ ...p, pushNewJob: v }))} />
              <Toggle label="Step completed" sub="Get notified when techs complete steps" checked={notifs.pushStepComplete} onChange={v => setNotifs(p => ({ ...p, pushStepComplete: v }))} />
            </div>

            <button type="button" onClick={saveNotifications} disabled={savingNotifs}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-semibold py-2.5 px-6 rounded-lg transition text-sm">
              {savingNotifs ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Preferences
            </button>
          </div>
        )}

        {/* ══════ SECURITY ══════ */}
        {tab === 'security' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Security</h1>
              <p className="text-slate-400 text-sm mt-1">Manage your password and account security</p>
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <h2 className="text-base font-semibold text-white mb-5 flex items-center gap-2">
                <Key className="w-4 h-4 text-blue-400" /> Change Password
              </h2>
              {pwErr && <Alert type="error" msg={pwErr} />}
              {pwOk  && <Alert type="success" msg="Password updated successfully!" />}
              <form onSubmit={changePassword} className="space-y-4">
                <Field label="Current Password">
                  <div className="relative">
                    <input type={showPw ? 'text' : 'password'} value={currentPw}
                      onChange={e => setCurrentPw(e.target.value)} placeholder="••••••••" className={input} />
                    <button type="button" onClick={() => setShowPw(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </Field>
                <Field label="New Password">
                  <input type={showPw ? 'text' : 'password'} value={newPw}
                    onChange={e => setNewPw(e.target.value)} placeholder="Min. 8 characters" className={input} />
                </Field>
                <Field label="Confirm New Password">
                  <input type={showPw ? 'text' : 'password'} value={confirmPw}
                    onChange={e => setConfirmPw(e.target.value)} placeholder="Repeat new password" className={input} />
                </Field>
                <button type="submit" disabled={savingPw}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-semibold py-2.5 px-6 rounded-lg transition text-sm">
                  {savingPw ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                  Update Password
                </button>
              </form>
            </div>

            {/* Security info */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white">Account Security</h3>
              {[
                { label: 'Two-Factor Authentication', value: 'Not enabled', action: 'Enable 2FA' },
                { label: 'Session Management', value: '1 active session', action: 'View Sessions' },
                { label: 'Login Activity', value: 'Last login: today', action: 'View History' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
                  <div>
                    <p className="text-sm text-white">{item.label}</p>
                    <p className="text-xs text-slate-400">{item.value}</p>
                  </div>
                  <button type="button" className="text-xs text-blue-400 hover:text-blue-300 font-medium transition">{item.action}</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════ CONNECTED APPS ══════ */}
        {tab === 'apps' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Connected Apps</h1>
              <p className="text-slate-400 text-sm mt-1">Integrate third-party tools with RoomLens Pro</p>
            </div>

            {/* Why connect banner */}
            <div className="bg-blue-900/20 rounded-xl border border-blue-700/30 p-4 flex items-start gap-3">
              <Plug className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-blue-300">Save time with integrations</p>
                <p className="text-xs text-slate-400 mt-0.5">Connect your existing tools to auto-sync jobs, clock-in times, estimates, and documents — no double entry.</p>
              </div>
            </div>

            <div className="space-y-4">
              {INTEGRATIONS.map(app => (
                <div key={app.id} className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl ${app.bg} flex items-center justify-center ${app.color} shrink-0`}>
                      {app.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-white">{app.name}</h3>
                        {app.status === 'coming_soon' && (
                          <span className="text-[10px] bg-yellow-900/40 text-yellow-400 border border-yellow-700/40 font-bold px-2 py-0.5 rounded-full uppercase">Coming Soon</span>
                        )}
                        {app.status === 'apply_required' && (
                          <span className="text-[10px] bg-orange-900/40 text-orange-400 border border-orange-700/40 font-bold px-2 py-0.5 rounded-full uppercase">Apply Required</span>
                        )}
                        {app.status === 'available' && (
                          <span className="text-[10px] bg-green-900/40 text-green-400 border border-green-700/40 font-bold px-2 py-0.5 rounded-full uppercase">Available</span>
                        )}
                        {connected[app.id] && (
                          <span className="flex items-center gap-1 text-[10px] bg-emerald-900/40 text-emerald-400 border border-emerald-700/40 font-bold px-2 py-0.5 rounded-full uppercase">
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> Connected
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{app.description}</p>

                      {/* Setup instructions */}
                      {!connected[app.id] && app.status !== 'coming_soon' && (
                        <div className="mt-3 space-y-2">
                          {app.status === 'apply_required' && (
                            <p className="text-xs text-orange-300 bg-orange-900/20 border border-orange-700/30 rounded-lg px-3 py-2">
                              ⚠️ Requires applying for API access at Verisk.{' '}
                              <a href={app.docsUrl} target="_blank" rel="noreferrer" className="underline hover:text-orange-200">Apply here →</a>
                            </p>
                          )}
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={apiKeys[app.id] || ''}
                              onChange={e => setApiKeys(p => ({ ...p, [app.id]: e.target.value }))}
                              placeholder="Paste your API key here"
                              className={`flex-1 ${input}`}
                              disabled={app.status === 'coming_soon'}
                            />
                            <button type="button"
                              onClick={() => connectApp(app.id)}
                              disabled={savingKey === app.id || !apiKeys[app.id]?.trim()}
                              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold rounded-lg transition whitespace-nowrap">
                              {savingKey === app.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect'}
                            </button>
                          </div>
                          <a href={app.docsUrl} target="_blank" rel="noreferrer"
                            className="text-xs text-blue-400 hover:text-blue-300 underline">
                            View API documentation →
                          </a>
                        </div>
                      )}

                      {connected[app.id] && (
                        <div className="mt-3 flex items-center gap-3">
                          <span className="text-xs text-emerald-400">✓ API key saved and active</span>
                          <button type="button" onClick={() => disconnectApp(app.id)}
                            className="text-xs text-red-400 hover:text-red-300 transition">
                            Disconnect
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

// ─── Helper components ─────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

function Alert({ type, msg }: { type: 'success' | 'error'; msg: string }) {
  return (
    <div className={`flex items-center gap-2 text-sm rounded-lg p-3 mb-4 ${
      type === 'success' ? 'bg-green-900/30 border border-green-700/40 text-green-400' : 'bg-red-900/30 border border-red-700/40 text-red-400'
    }`}>
      {type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
      {msg}
    </div>
  );
}

function Toggle({ label, sub, checked, onChange }: { label: string; sub: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-700/50 last:border-0">
      <div>
        <p className="text-sm text-white">{label}</p>
        <p className="text-xs text-slate-400">{sub}</p>
      </div>
      <button type="button" onClick={() => onChange(!checked)}
        className={`transition-colors ${checked ? 'text-blue-400' : 'text-slate-600'}`}>
        {checked ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
      </button>
    </div>
  );
}

function MemberCard({ m, onEdit, onToggle, onDelete }: {
  m: TeamMember;
  onEdit: (m: TeamMember) => void;
  onToggle: (m: TeamMember) => void;
  onDelete: (id: string, name: string) => void;
}) {
  const roleInfo = ROLES[m.role] || ROLES.other;
  const inviteLink = m.invite_token
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://roomlenspro.com'}/staff/invite/${m.invite_token}`
    : null;

  // Invite status badge
  const inviteBadge = (() => {
    if (m.nda_accepted && m.invite_status === 'active') return { label: '✅ Active', cls: 'bg-green-900/60 text-green-300' };
    if (m.invite_status === 'invited') return { label: '📨 Invite Sent', cls: 'bg-yellow-900/60 text-yellow-300' };
    if (m.invite_status === 'pending') return { label: '⏳ Not Invited', cls: 'bg-slate-700 text-slate-400' };
    if (m.invite_status === 'suspended') return { label: '🚫 Suspended', cls: 'bg-red-900/60 text-red-300' };
    return null;
  })();

  return (
    <div className={`bg-slate-800 rounded-xl border p-4 transition ${m.is_active ? 'border-slate-700' : 'border-slate-700/40 opacity-50'}`}>
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${m.is_active ? 'bg-blue-900/50 text-blue-300' : 'bg-slate-700 text-slate-500'}`}>
          {m.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white">{m.full_name}</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${roleInfo.color}`}>{roleInfo.label}</span>
            {!m.is_active && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">INACTIVE</span>}
            {inviteBadge && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${inviteBadge.cls}`}>{inviteBadge.label}</span>}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {m.cell_phone && <a href={`tel:${m.cell_phone}`} className="flex items-center gap-1 text-xs text-blue-400 hover:underline"><Phone className="w-3 h-3" />{m.cell_phone}</a>}
            {m.email && <a href={`mailto:${m.email}`} className="flex items-center gap-1 text-xs text-slate-400 hover:underline"><Mail className="w-3 h-3" />{m.email}</a>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={() => onEdit(m)} title="Edit"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition">
            <Edit3 className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => onToggle(m)} title={m.is_active ? 'Deactivate' : 'Activate'}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition">
            {m.is_active ? <ToggleRight className="w-4 h-4 text-green-400" /> : <ToggleLeft className="w-4 h-4" />}
          </button>
          <button type="button" onClick={() => onDelete(m.id, m.full_name)} title="Delete"
            className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-900/20 transition">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Invite link row — shown if invite_token exists and not yet active */}
      {inviteLink && m.invite_status !== 'active' && (
        <div className="mt-3 pt-3 border-t border-slate-700/60 flex items-center gap-2">
          <Send className="w-3.5 h-3.5 text-teal-400 shrink-0" />
          <code className="text-teal-300 text-xs flex-1 truncate">{inviteLink}</code>
          <button
            onClick={() => navigator.clipboard.writeText(inviteLink)}
            className="text-slate-400 hover:text-teal-300 transition shrink-0" title="Copy invite link">
            <Copy className="w-3.5 h-3.5" />
          </button>
          {m.cell_phone && (
            <a
              href={`sms:${m.cell_phone}?body=${encodeURIComponent(`Hi ${m.full_name.split(' ')[0]}! Here is your RoomLens Pro invite link: ${inviteLink}`)}`}
              className="text-slate-400 hover:text-teal-300 transition shrink-0" title="Send via text">
              <Phone className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Suspense wrapper (required for useSearchParams in Next 14) ────────────────
export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">Loading settings...</div>
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}
