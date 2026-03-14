'use client';
import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { usePermissions, AccessDenied } from '@/hooks/usePermissions';
import {
  User, Building2, Mail, Save, Loader2, CheckCircle, AlertCircle,
  Users, Plus, Phone, Trash2, Edit3, X, Shield, Bell, CreditCard,
  Plug, Key, Eye, EyeOff, ToggleLeft, ToggleRight,
  ChevronRight, Zap, Globe, BarChart2, FileText, Clock,
  Send, Copy, ExternalLink, Lock, Upload,
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

type Tab = 'profile' | 'team' | 'billing' | 'notifications' | 'security' | 'apps' | 'documents';

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

const TABS: { id: Tab; label: string; icon: React.ReactNode; permission?: string }[] = [
  { id: 'profile',       label: 'Profile',        icon: <User className="w-4 h-4" /> },
  { id: 'team',          label: 'Team Members',   icon: <Users className="w-4 h-4" />,       permission: 'settings_team'          },
  { id: 'documents',     label: 'Documents',      icon: <FileText className="w-4 h-4" />,    permission: 'settings_billing'       },
  { id: 'billing',       label: 'Plan & Billing', icon: <CreditCard className="w-4 h-4" />,  permission: 'settings_billing'       },
  { id: 'notifications', label: 'Notifications',  icon: <Bell className="w-4 h-4" />,        permission: 'settings_notifications' },
  { id: 'security',      label: 'Security',       icon: <Shield className="w-4 h-4" />,      permission: 'settings_security'      },
  { id: 'apps',          label: 'Connected Apps', icon: <Plug className="w-4 h-4" />,        permission: 'settings_apps'          },
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
  const { can, loading: permLoading } = usePermissions();
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
    url: string; sms: string; name: string; phone: string; smsSent?: boolean;
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
    setMemberForm({ full_name: m.full_name, role: m.role, cell_phone: m.cell_phone || '', email: m.email || '', notes: m.notes || '', temp_password: '' });
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
        // Insert new member — exclude temp_password (not a DB column, only used for auth)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { temp_password: _tp, ...memberData } = memberForm;
        const { data: newMember, error: insertError } = await supabase
          .from('team_members')
          .insert({ ...memberData, user_id: userId, is_active: true })
          .select('id').single();
        if (insertError || !newMember) { setMemberErr(insertError?.message || 'Insert failed.'); return; }
        memberId = newMember.id;

        // Send invite via API (includes auto-SMS if Twilio configured)
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
      <div className="flex items-center justify-center h-full min-h-screen bg-[#0a0f1e]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  const visibleTabs = TABS.filter(t => !t.permission || can(t.permission as Parameters<typeof can>[0]));

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-screen bg-slate-900">

      {/* ── Mobile: horizontal scrollable tab bar ── */}
      <div className="lg:hidden sticky top-14 z-30 bg-slate-900 border-b border-slate-700/60 shadow-sm">
        <div className="flex overflow-x-auto scrollbar-hide px-2 py-2 gap-1">
          {permLoading ? (
            <div className="flex gap-2 px-2">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="h-8 w-24 bg-slate-700/50 rounded-full animate-pulse shrink-0" />
              ))}
            </div>
          ) : (
            visibleTabs.map(t => (
              <button key={t.id} type="button"
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition ${
                  tab === t.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 bg-slate-800 hover:text-white hover:bg-slate-700'
                }`}>
                <span className="[&>svg]:w-3 [&>svg]:h-3">{t.icon}</span>
                {t.label}
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Desktop: left sidebar ── */}
      <aside className="hidden lg:flex w-56 shrink-0 bg-slate-800/60 border-r border-slate-700 flex-col pt-6">
        <p className="px-5 text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3">Settings</p>
        <nav className="flex-1">
          {permLoading ? (
            <div className="space-y-1 px-3">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="h-9 bg-slate-700/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            visibleTabs.map(t => (
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
            ))
          )}
        </nav>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-full lg:max-w-3xl">

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
                  className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 disabled:bg-blue-800 text-white font-semibold py-2.5 px-6 rounded-lg transition text-sm">
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
            {!permLoading && !can('settings_team') && <AccessDenied feature="Team Members" />}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white">Team Members</h1>
                <p className="text-slate-400 text-sm mt-1">Employees who can be assigned to jobs</p>
              </div>
              <button type="button" onClick={openAdd}
                className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition">
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
                      className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 disabled:bg-blue-800 text-white font-semibold py-2 px-5 rounded-lg transition text-sm">
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
                      <p className="text-teal-300 text-xs">
                        Account created for {inviteResult.name}
                        {inviteResult.smsSent && <span className="ml-2 text-green-400 font-semibold">· 📱 SMS sent!</span>}
                      </p>
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

                {/* Send via SMS */}
                {inviteResult.smsSent ? (
                  <div className="flex items-center justify-center gap-2 w-full bg-green-700/30 border border-green-600/40 text-green-300 font-semibold py-2.5 px-5 rounded-xl text-sm">
                    <CheckCircle className="w-4 h-4" />
                    SMS Sent to {inviteResult.name.split(' ')[0]} ✅
                  </div>
                ) : inviteResult.phone ? (
                  <a
                    href={`sms:${inviteResult.phone}?body=${encodeURIComponent(inviteResult.sms)}`}
                    className="flex items-center justify-center gap-2 w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2.5 px-5 rounded-xl transition text-sm">
                    <Phone className="w-4 h-4" />
                    Open Text Message to {inviteResult.name.split(' ')[0]}
                  </a>
                ) : null}
                <p className="text-slate-500 text-xs mt-3 text-center">
                  {inviteResult.smsSent
                    ? 'SMS was automatically sent. Staff must click the link, sign the NDA, and set their own password.'
                    : 'Copy and send the link via text or email. Staff must click the link, sign the NDA, and set their own password.'
                  }
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
                  className="mt-4 inline-flex items-center gap-1.5 bg-cyan-500 hover:bg-cyan-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
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
            {!permLoading && !can('settings_billing') ? (
              <AccessDenied feature="Plan & Billing" />
            ) : (
              <>
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
                    className={`w-full py-2 rounded-lg text-sm font-semibold transition ${p.highlight ? 'bg-cyan-500 hover:bg-cyan-400 text-white' : 'border border-slate-600 text-slate-300 hover:border-slate-500 hover:text-white'}`}>
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
              </>
            )}
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
              className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 disabled:bg-blue-800 text-white font-semibold py-2.5 px-6 rounded-lg transition text-sm">
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
                  className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 disabled:bg-blue-800 text-white font-semibold py-2.5 px-6 rounded-lg transition text-sm">
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
            {!permLoading && !can('settings_apps') ? (
              <AccessDenied feature="Connected Apps" />
            ) : (
              <>
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
                              className="px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold rounded-lg transition whitespace-nowrap">
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
              </>
            )}
          </div>
        )}

        {/* ══════ DOCUMENTS ══════ */}
        {tab === 'documents' && (
          <DocumentTemplatesSection userId={userId} />
        )}

      </main>
    </div>
  );
}

// ─── Document Templates Section ────────────────────────────────────────────────
function DocumentTemplatesSection({ userId }: { userId: string | null }) {
  const DOC_TYPES = [
    { value: 'waf',                       label: 'Work Authorization Form'        },
    { value: 'direction_to_pay',          label: 'Direction to Pay'               },
    { value: 'assignment_of_benefits',    label: 'Assignment of Benefits'         },
    { value: 'certificate_of_completion', label: 'Certificate of Completion'      },
    { value: 'property_access',           label: 'Property Access Authorization'  },
    { value: 'contents_release',          label: 'Contents Inventory Release'     },
    { value: 'photo_consent',             label: 'Photo/Video Consent'            },
    { value: 'mold_auth',                 label: 'Mold Remediation Authorization' },
    { value: 'scope_of_work',             label: 'Scope of Work'                  },
    { value: 'final_report',              label: 'Final Report'                   },
    { value: 'proof_of_loss',             label: 'Proof of Loss'                  },
    { value: 'staff_nda',                 label: 'Staff NDA'                      },
    { value: 'subcontractor_agreement',   label: 'Subcontractor Agreement'        },
    { value: 'other',                     label: 'Other'                          },
  ];

  const MERGE_TAGS = [
    { tag: '{{client_name}}',       label: 'Client Name'       },
    { tag: '{{client_phone}}',      label: 'Client Phone'      },
    { tag: '{{client_email}}',      label: 'Client Email'      },
    { tag: '{{property_address}}',  label: 'Property Address'  },
    { tag: '{{claim_number}}',      label: 'Claim Number'      },
    { tag: '{{insurance_company}}', label: 'Insurance Co'      },
    { tag: '{{adjuster_name}}',     label: 'Adjuster Name'     },
    { tag: '{{adjuster_phone}}',    label: 'Adjuster Phone'    },
    { tag: '{{date_of_loss}}',      label: 'Date of Loss'      },
    { tag: '{{company_name}}',      label: 'Company Name'      },
    { tag: '{{today_date}}',        label: 'Today\'s Date'     },
    { tag: '{{sign_date}}',         label: 'Sign Date'         },
  ];

  const DEFAULT_BODY: Record<string, string> = {
    waf: `<h2>WORK AUTHORIZATION FORM</h2>
<p>This agreement is made between <strong>{{company_name}}</strong> ("Contractor") and <strong>{{client_name}}</strong> ("Client").</p>
<p><strong>Property Address:</strong> {{property_address}}</p>
<p><strong>Date of Loss:</strong> {{date_of_loss}}</p>
<p><strong>Claim Number:</strong> {{claim_number}}</p>
<p><strong>Insurance Company:</strong> {{insurance_company}}</p>
<hr/>
<p>The Client hereby authorizes the Contractor to perform all necessary water mitigation, drying, and restoration services at the above property. The Client agrees to cooperate fully with the Contractor and insurance company throughout the claims process.</p>
<p><strong>Client:</strong> {{client_name}} | <strong>Phone:</strong> {{client_phone}}</p>
<p><strong>Date:</strong> {{today_date}}</p>`,
    direction_to_pay: `<h2>DIRECTION TO PAY</h2>
<p>I/We, <strong>{{client_name}}</strong>, owner(s) of property located at <strong>{{property_address}}</strong>, hereby authorize and direct <strong>{{insurance_company}}</strong> to pay all proceeds due under Claim No. <strong>{{claim_number}}</strong> directly to <strong>{{company_name}}</strong> for services rendered.</p>
<p><strong>Adjuster:</strong> {{adjuster_name}} | {{adjuster_phone}}</p>
<p><strong>Date of Loss:</strong> {{date_of_loss}}</p>
<p><strong>Date:</strong> {{today_date}}</p>`,
  };

  interface Template {
    id: string;
    name: string;
    doc_type: string;
    description: string | null;
    file_name: string | null;
    body_html: string | null;
    requires_signature: boolean;
    is_active: boolean;
    created_at: string;
  }

  const [templates, setTemplates]   = useState<Template[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  const [uploading, setUploading]   = useState(false);
  const [activeTab, setActiveTab]   = useState<'editor'|'upload'>('editor');
  const [form, setForm]             = useState({
    name: '', doc_type: 'waf', description: '', requires_signature: true, body_html: '',
  });
  const [file, setFile]             = useState<File | null>(null);
  const [ok, setOk]                 = useState('');
  const [err, setErr]               = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('document_templates')
      .select('*')
      .eq('company_id', userId)
      .order('sort_order')
      .then(({ data }) => { setTemplates((data as Template[]) || []); setLoading(false); });
  }, [userId]);

  function openNew() {
    setEditTemplate(null);
    setForm({ name: '', doc_type: 'waf', description: '', requires_signature: true, body_html: DEFAULT_BODY['waf'] || '' });
    setFile(null); setOk(''); setErr('');
    setActiveTab('editor');
    setPreviewMode(false);
    setShowForm(true);
  }

  function openEdit(t: Template) {
    setEditTemplate(t);
    setForm({
      name: t.name,
      doc_type: t.doc_type,
      description: t.description || '',
      requires_signature: t.requires_signature,
      body_html: t.body_html || DEFAULT_BODY[t.doc_type] || '',
    });
    setFile(null); setOk(''); setErr('');
    setActiveTab('editor');
    setPreviewMode(false);
    setShowForm(true);
  }

  function insertTag(tag: string) {
    const ta = bodyRef.current;
    if (!ta) {
      setForm(p => ({ ...p, body_html: p.body_html + tag }));
      return;
    }
    const start = ta.selectionStart ?? ta.value.length;
    const end   = ta.selectionEnd   ?? ta.value.length;
    const newVal = ta.value.slice(0, start) + tag + ta.value.slice(end);
    setForm(p => ({ ...p, body_html: newVal }));
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + tag.length, start + tag.length);
    }, 0);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !form.name || !form.doc_type) { setErr('Name and type are required.'); return; }
    setUploading(true); setErr(''); setOk('');

    let storagePath: string | null = editTemplate?.file_name ? (editTemplate as unknown as Record<string,string>)['storage_path'] : null;
    let fileName: string | null = editTemplate?.file_name || null;

    if (file) {
      const path = `${userId}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from('document-templates').upload(path, file);
      if (uploadErr) { setErr(uploadErr.message); setUploading(false); return; }
      storagePath = path;
      fileName = file.name;
    }

    const payload = {
      company_id: userId,
      name: form.name,
      doc_type: form.doc_type,
      description: form.description || null,
      requires_signature: form.requires_signature,
      body_html: form.body_html || null,
      storage_path: storagePath,
      file_name: fileName,
      is_active: true,
    };

    if (editTemplate) {
      const { data, error } = await supabase
        .from('document_templates')
        .update(payload)
        .eq('id', editTemplate.id)
        .select()
        .single();
      if (error) { setErr(error.message); setUploading(false); return; }
      setTemplates(prev => prev.map(t => t.id === editTemplate.id ? data as Template : t));
      setOk('Template updated!');
    } else {
      const { data, error } = await supabase
        .from('document_templates')
        .insert(payload)
        .select()
        .single();
      if (error) { setErr(error.message); setUploading(false); return; }
      setTemplates(prev => [...prev, data as Template]);
      setOk('Template saved!');
    }

    setShowForm(false);
    setEditTemplate(null);
    setUploading(false);
  }

  async function toggleActive(t: Template) {
    await supabase.from('document_templates').update({ is_active: !t.is_active }).eq('id', t.id);
    setTemplates(prev => prev.map(x => x.id === t.id ? { ...x, is_active: !x.is_active } : x));
  }

  async function deleteTemplate(id: string, name: string) {
    if (!confirm(`Delete template "${name}"?`)) return;
    await supabase.from('document_templates').delete().eq('id', id);
    setTemplates(prev => prev.filter(t => t.id !== id));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Document Templates</h1>
        <p className="text-slate-400 text-sm mt-1">
          Create WAF, Direction to Pay, NDA and more. Job data auto-fills merge tags on send.
        </p>
      </div>

      {/* Merge tags guide */}
      <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-4">
        <p className="text-sm font-semibold text-blue-300 mb-2">📌 Merge Tags — click to copy</p>
        <p className="text-xs text-blue-400/80 mb-2">Insert in template body — they auto-fill from job data when sent to clients:</p>
        <div className="flex flex-wrap gap-1.5">
          {MERGE_TAGS.map(mt => (
            <button
              key={mt.tag}
              type="button"
              onClick={() => { navigator.clipboard.writeText(mt.tag); }}
              title={`Copy ${mt.tag}`}
              className="bg-blue-900/50 hover:bg-blue-800/70 text-blue-200 text-[11px] font-mono px-2 py-0.5 rounded-lg border border-blue-800/60 transition cursor-pointer"
            >
              {mt.tag}
            </button>
          ))}
        </div>
      </div>

      {ok && (
        <div className="bg-green-900/30 border border-green-800/50 rounded-xl p-3 text-sm text-green-300 flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />{ok}
        </div>
      )}

      {/* Add template button */}
      {!showForm && (
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition shadow-lg shadow-blue-900/30"
        >
          <Plus className="w-4 h-4" /> New Template
        </button>
      )}

      {/* Template form */}
      {showForm && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          {/* Form header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700 bg-slate-800/80">
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" />
              {editTemplate ? `Edit: ${editTemplate.name}` : 'New Template'}
            </h3>
            <button type="button" onClick={() => { setShowForm(false); setEditTemplate(null); }}
              className="text-slate-400 hover:text-white transition p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSave} className="p-5 space-y-4">
            {/* Name + Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide">Template Name *</label>
                <input type="text" required placeholder="e.g. Work Authorization Form"
                  value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide">Document Type *</label>
                <select value={form.doc_type}
                  onChange={e => {
                    const dt = e.target.value;
                    setForm(p => ({
                      ...p,
                      doc_type: dt,
                      body_html: p.body_html || DEFAULT_BODY[dt] || '',
                    }));
                  }}
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition">
                  {DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide">Description</label>
              <input type="text" placeholder="Optional short description"
                value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition" />
            </div>

            {/* Requires signature */}
            <div className="flex items-center gap-3">
              <input type="checkbox" id="req_sig" checked={form.requires_signature}
                onChange={e => setForm(p => ({ ...p, requires_signature: e.target.checked }))}
                className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-blue-600 focus:ring-blue-500" />
              <label htmlFor="req_sig" className="text-sm text-slate-300">Requires client e-signature</label>
            </div>

            {/* Editor / Upload tabs */}
            <div>
              <div className="flex rounded-xl overflow-hidden border border-slate-600 mb-3 w-fit">
                <button type="button" onClick={() => setActiveTab('editor')}
                  className={`px-4 py-1.5 text-xs font-semibold transition ${activeTab === 'editor' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                  ✍️ Template Editor
                </button>
                <button type="button" onClick={() => setActiveTab('upload')}
                  className={`px-4 py-1.5 text-xs font-semibold transition ${activeTab === 'upload' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                  📎 Upload PDF/DOC
                </button>
              </div>

              {activeTab === 'editor' && (
                <div className="space-y-2">
                  {/* Quick-insert merge tags */}
                  <div>
                    <p className="text-[11px] text-slate-500 mb-1.5 font-semibold uppercase tracking-wide">Quick Insert →</p>
                    <div className="flex flex-wrap gap-1">
                      {MERGE_TAGS.map(mt => (
                        <button key={mt.tag} type="button" onClick={() => insertTag(mt.tag)}
                          className="text-[10px] font-mono bg-slate-700 hover:bg-blue-800/60 text-slate-300 hover:text-blue-200 px-2 py-0.5 rounded border border-slate-600 hover:border-blue-700 transition">
                          {mt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Toggle preview */}
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Document Body (HTML / Plain Text)</label>
                    <button type="button" onClick={() => setPreviewMode(p => !p)}
                      className="text-xs text-blue-400 hover:text-blue-300 font-semibold transition flex items-center gap-1">
                      <Eye className="w-3 h-3" /> {previewMode ? 'Edit' : 'Preview'}
                    </button>
                  </div>

                  {previewMode ? (
                    <div
                      className="bg-white text-gray-800 rounded-xl p-4 text-sm leading-relaxed min-h-[200px] border border-slate-600 overflow-y-auto"
                      dangerouslySetInnerHTML={{ __html: form.body_html || '<p class="text-gray-400 italic">No content yet.</p>' }}
                    />
                  ) : (
                    <textarea
                      ref={bodyRef}
                      rows={10}
                      placeholder="Type document content here. Use HTML tags for formatting (<h2>, <p>, <strong>, <hr/>). Insert merge tags using buttons above."
                      value={form.body_html}
                      onChange={e => setForm(p => ({ ...p, body_html: e.target.value }))}
                      className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-blue-500 transition resize-y leading-relaxed"
                      spellCheck={false}
                    />
                  )}
                  <p className="text-[10px] text-slate-500">
                    Supports basic HTML tags. Merge tags will be auto-replaced with job data when sent to the client.
                  </p>
                </div>
              )}

              {activeTab === 'upload' && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide">
                    Upload Template File (PDF, DOC, DOCX)
                  </label>
                  <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.jpg,.png"
                    onChange={e => setFile(e.target.files?.[0] || null)}
                    className="w-full bg-slate-700 border border-slate-600 text-slate-300 rounded-xl px-3 py-2 text-sm file:mr-3 file:bg-blue-600 file:text-white file:rounded-lg file:border-0 file:text-xs file:font-semibold" />
                  <p className="text-[10px] text-slate-500">PDF/Word file will be stored for reference. Use template editor for auto-fill content.</p>
                  {editTemplate?.file_name && !file && (
                    <p className="text-xs text-teal-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Current file: {editTemplate.file_name}
                    </p>
                  )}
                </div>
              )}
            </div>

            {err && <div className="bg-red-900/30 border border-red-800/60 rounded-xl p-3 text-sm text-red-300">{err}</div>}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => { setShowForm(false); setEditTemplate(null); }}
                className="flex-1 px-3 py-2 rounded-xl bg-slate-700 text-slate-300 text-sm font-semibold hover:bg-slate-600 transition">
                Cancel
              </button>
              <button type="submit" disabled={uploading}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold transition">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {uploading ? 'Saving…' : editTemplate ? 'Update Template' : 'Save Template'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Templates list */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-800/50 rounded-xl animate-pulse" />)}
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-slate-800/60 rounded-xl border border-slate-700 border-dashed p-8 text-center">
          <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-400 text-sm font-medium">No templates yet</p>
          <p className="text-slate-500 text-xs mt-1">Create your WAF, Direction to Pay, NDA, and other documents above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <div key={t.id} className={`flex items-center gap-3 bg-slate-800 rounded-xl border px-4 py-3 transition ${t.is_active ? 'border-slate-700' : 'border-slate-700/40 opacity-60'}`}>
              <FileText className="w-5 h-5 text-blue-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{t.name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <p className="text-xs text-slate-500">{DOC_TYPES.find(d => d.value === t.doc_type)?.label || t.doc_type}</p>
                  {t.body_html && <span className="text-[10px] bg-teal-900/40 text-teal-300 px-1.5 py-0 rounded font-semibold">✍️ Inline</span>}
                  {t.file_name && <span className="text-[10px] bg-slate-700 text-slate-400 px-1.5 py-0 rounded font-semibold">📎 {t.file_name}</span>}
                </div>
              </div>
              {t.requires_signature && (
                <span className="text-[10px] bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded-full font-semibold shrink-0">Sig</span>
              )}
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => openEdit(t)} title="Edit template"
                  className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded-lg transition">
                  <Edit3 className="w-4 h-4" />
                </button>
                <button onClick={() => toggleActive(t)} title={t.is_active ? 'Deactivate' : 'Activate'}
                  className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-700 rounded-lg transition">
                  {t.is_active ? <ToggleRight className="w-4 h-4 text-blue-400" /> : <ToggleLeft className="w-4 h-4" />}
                </button>
                <button onClick={() => deleteTemplate(t.id, t.name)}
                  className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
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
