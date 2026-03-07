'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  User, Building2, Mail, Save, Loader2, CheckCircle, AlertCircle,
  Users, Plus, Phone, Trash2, Edit3, X, Shield,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Profile {
  id: string; email: string; full_name: string | null;
  company_name: string | null; role: string; subscription_tier: string;
}

interface TeamMember {
  id: string; full_name: string; role: string;
  cell_phone: string | null; email: string | null;
  is_active: boolean; notes: string | null; created_at: string;
}

const ROLES: Record<string, { label: string; color: string }> = {
  admin:         { label: 'Admin',          color: 'bg-purple-100 text-purple-700' },
  office:        { label: 'Office',         color: 'bg-blue-100 text-blue-700'    },
  estimator:     { label: 'Estimator',      color: 'bg-cyan-100 text-cyan-700'    },
  lead_tech:     { label: 'Lead Tech',      color: 'bg-green-100 text-green-700'  },
  tech:          { label: 'Technician',     color: 'bg-teal-100 text-teal-700'    },
  subcontractor: { label: 'Subcontractor',  color: 'bg-orange-100 text-orange-700'},
  other:         { label: 'Other',          color: 'bg-gray-100 text-gray-600'    },
};

const TIER_BADGES: Record<string, string> = {
  free: 'bg-gray-100 text-gray-600', starter: 'bg-blue-100 text-blue-700',
  pro: 'bg-purple-100 text-purple-700', enterprise: 'bg-yellow-100 text-yellow-700',
};

const cls = 'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none';

const BLANK_MEMBER = { full_name: '', role: 'tech', cell_phone: '', email: '', notes: '' };

// ─── Component ────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<'profile' | 'team'>(() => {
    // Will be overridden by useEffect below once searchParams is available
    return 'profile';
  });

  // — Profile state
  const [profile, setProfile]     = useState<Profile | null>(null);
  const [fullName, setFullName]   = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile,  setSavingProfile]  = useState(false);
  const [profileOk,  setProfileOk]  = useState(false);
  const [profileErr, setProfileErr] = useState('');

  // — Team state
  const [members,       setMembers]     = useState<TeamMember[]>([]);
  const [loadingTeam,   setLoadingTeam] = useState(false);
  const [showForm,      setShowForm]    = useState(false);
  const [editId,        setEditId]      = useState<string | null>(null);
  const [memberForm,    setMemberForm]  = useState(BLANK_MEMBER);
  const [savingMember,  setSavingMember] = useState(false);
  const [memberOk,      setMemberOk]    = useState('');
  const [memberErr,     setMemberErr]   = useState('');
  const [userId,        setUserId]      = useState('');

  // ── Read ?tab= URL param ──────────────────────────────────────────────────
  useEffect(() => {
    if (searchParams.get('tab') === 'team') setTab('team');
  }, [searchParams]);

  // ── Load profile ──────────────────────────────────────────────────────────
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
        setCompanyName(session.user.user_metadata?.company_name || '');
      }
      setLoadingProfile(false);
    })();
  }, [router]);

  // ── Load team when tab switches ────────────────────────────────────────────
  useEffect(() => {
    if (tab !== 'team' || !userId) return;
    fetchTeam();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, userId]);

  const fetchTeam = async () => {
    setLoadingTeam(true);
    const { data } = await supabase
      .from('team_members')
      .select('*')
      .eq('user_id', userId)
      .order('is_active', { ascending: false })
      .order('full_name');
    setMembers(data || []);
    setLoadingTeam(false);
  };

  // ── Save profile ──────────────────────────────────────────────────────────
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

  // ── Team CRUD ─────────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditId(null);
    setMemberForm(BLANK_MEMBER);
    setMemberErr(''); setMemberOk('');
    setShowForm(true);
  };

  const openEdit = (m: TeamMember) => {
    setEditId(m.id);
    setMemberForm({ full_name: m.full_name, role: m.role, cell_phone: m.cell_phone || '', email: m.email || '', notes: m.notes || '' });
    setMemberErr(''); setMemberOk('');
    setShowForm(true);
  };

  const saveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberForm.full_name.trim()) { setMemberErr('Name is required.'); return; }
    setSavingMember(true); setMemberErr(''); setMemberOk('');
    try {
      if (editId) {
        const { error } = await supabase.from('team_members').update({
          full_name: memberForm.full_name.trim(),
          role: memberForm.role,
          cell_phone: memberForm.cell_phone || null,
          email: memberForm.email || null,
          notes: memberForm.notes || null,
          updated_at: new Date().toISOString(),
        }).eq('id', editId);
        if (error) throw error;
        setMemberOk('Team member updated!');
      } else {
        const { error } = await supabase.from('team_members').insert({
          user_id: userId,
          full_name: memberForm.full_name.trim(),
          role: memberForm.role,
          cell_phone: memberForm.cell_phone || null,
          email: memberForm.email || null,
          notes: memberForm.notes || null,
        });
        if (error) throw error;
        setMemberOk('Team member added!');
      }
      await fetchTeam();
      setShowForm(false);
      setTimeout(() => setMemberOk(''), 3000);
    } catch (err: unknown) {
      setMemberErr(err instanceof Error ? err.message : 'Save failed.');
    } finally { setSavingMember(false); }
  };

  const toggleActive = async (m: TeamMember) => {
    await supabase.from('team_members').update({ is_active: !m.is_active, updated_at: new Date().toISOString() }).eq('id', m.id);
    setMembers(prev => prev.map(x => x.id === m.id ? { ...x, is_active: !m.is_active } : x));
  };

  const deleteMember = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from your team? This cannot be undone.`)) return;
    await supabase.from('team_members').delete().eq('id', id);
    setMembers(prev => prev.filter(x => x.id !== id));
    setMemberOk(`${name} removed.`);
    setTimeout(() => setMemberOk(''), 3000);
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loadingProfile) {
    return <div className="flex items-center justify-center h-full min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-0.5">Manage your account and team</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(['profile', 'team'] as const).map(t => (
          <button key={t} type="button"
            onClick={() => setTab(t)}
            onKeyDown={e => { if (e.key === ' ') e.preventDefault(); }}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition capitalize ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t === 'profile' ? <><User className="w-3.5 h-3.5 inline mr-1.5" />Profile</> : <><Users className="w-3.5 h-3.5 inline mr-1.5" />Team Members</>}
          </button>
        ))}
      </div>

      {/* ══════════ PROFILE TAB ══════════ */}
      {tab === 'profile' && (
        <>
          {/* Plan badge */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Current Plan</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-sm font-semibold px-3 py-1 rounded-full capitalize ${TIER_BADGES[profile?.subscription_tier || 'free']}`}>
                    {profile?.subscription_tier || 'free'}
                  </span>
                  <span className="text-xs text-gray-400 capitalize">• {profile?.role} role</span>
                </div>
              </div>
              <button type="button" className="text-sm text-blue-600 hover:text-blue-800 font-medium">Upgrade Plan →</button>
            </div>
          </div>

          {/* Profile form */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-500" /> Profile Information
            </h2>
            {profileErr && <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-4"><AlertCircle className="w-4 h-4 shrink-0" />{profileErr}</div>}
            {profileOk && <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg p-3 mb-4"><CheckCircle className="w-4 h-4 shrink-0" /> Profile saved!</div>}
            <form onSubmit={saveProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="email" value={profile?.email || ''} disabled className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500 cursor-not-allowed" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="John Smith"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Smith Restoration Inc."
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <button type="submit" disabled={savingProfile}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 px-5 rounded-lg transition text-sm">
                {savingProfile ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save Changes</>}
              </button>
            </form>
          </div>

          {/* Sign out */}
          <div className="bg-white rounded-xl border border-red-200 p-5">
            <h2 className="text-base font-semibold text-red-700 mb-2">Session</h2>
            <button type="button"
              onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }}
              className="text-sm text-red-600 border border-red-300 hover:bg-red-50 px-4 py-2 rounded-lg transition font-medium">
              Sign Out
            </button>
          </div>
        </>
      )}

      {/* ══════════ TEAM TAB ══════════ */}
      {tab === 'team' && (
        <div className="space-y-4">

          {/* Header row */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Add your office staff, technicians and subcontractors.</p>
              <p className="text-xs text-gray-400 mt-0.5">They appear in the <strong>File Created By</strong> and <strong>Dispatch</strong> dropdowns on every job.</p>
            </div>
            <button type="button" onClick={openAdd}
              onKeyDown={e => { if (e.key === ' ') e.preventDefault(); }}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
              <Plus className="w-4 h-4" /> Add Member
            </button>
          </div>

          {/* Global feedback */}
          {memberOk && <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg p-3"><CheckCircle className="w-4 h-4 shrink-0" />{memberOk}</div>}
          {memberErr && !showForm && <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3"><AlertCircle className="w-4 h-4 shrink-0" />{memberErr}</div>}

          {/* Add / Edit form */}
          {showForm && (
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-blue-800 flex items-center gap-2">
                  {editId ? <><Edit3 className="w-4 h-4" /> Edit Team Member</> : <><Plus className="w-4 h-4" /> Add Team Member</>}
                </h3>
                <button type="button" onClick={() => setShowForm(false)} onKeyDown={e => { if (e.key === ' ') e.preventDefault(); }}
                  className="p-1.5 hover:bg-blue-100 rounded-lg transition"><X className="w-4 h-4 text-blue-600" /></button>
              </div>

              {memberErr && <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3"><AlertCircle className="w-4 h-4 shrink-0" />{memberErr}</div>}

              <form onSubmit={saveMember} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Full Name <span className="text-red-500">*</span></label>
                  <input type="text" value={memberForm.full_name}
                    onChange={e => setMemberForm(p => ({ ...p, full_name: e.target.value }))}
                    placeholder="e.g. Mike Johnson" className={cls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                  <select value={memberForm.role}
                    onChange={e => setMemberForm(p => ({ ...p, role: e.target.value }))}
                    className={cls}>
                    {Object.entries(ROLES).map(([v, { label }]) => (
                      <option key={v} value={v}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cell Phone</label>
                  <input type="tel" value={memberForm.cell_phone}
                    onChange={e => setMemberForm(p => ({ ...p, cell_phone: e.target.value }))}
                    placeholder="(613) 555-0100" className={cls} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                  <input type="email" value={memberForm.email}
                    onChange={e => setMemberForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="mike@company.com" className={cls} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                  <input type="text" value={memberForm.notes}
                    onChange={e => setMemberForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Certifications, specialty, etc." className={cls} />
                </div>
                <div className="sm:col-span-2 flex gap-2">
                  <button type="submit" disabled={savingMember}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition">
                    {savingMember ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> {editId ? 'Update' : 'Add to Team'}</>}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)}
                    onKeyDown={e => { if (e.key === ' ') e.preventDefault(); }}
                    className="px-5 py-2.5 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Team list */}
          {loadingTeam ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
          ) : members.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
              <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No team members yet</p>
              <p className="text-gray-400 text-sm mt-1">Add your first team member to enable dropdowns in jobs</p>
              <button type="button" onClick={openAdd}
                onKeyDown={e => { if (e.key === ' ') e.preventDefault(); }}
                className="mt-4 inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
                <Plus className="w-4 h-4" /> Add First Member
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Active members */}
              {members.filter(m => m.is_active).map(m => (
                <MemberCard key={m.id} m={m} onEdit={openEdit} onToggle={toggleActive} onDelete={deleteMember} />
              ))}
              {/* Inactive members */}
              {members.filter(m => !m.is_active).length > 0 && (
                <>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-2 pb-1">Inactive</p>
                  {members.filter(m => !m.is_active).map(m => (
                    <MemberCard key={m.id} m={m} onEdit={openEdit} onToggle={toggleActive} onDelete={deleteMember} />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}

// ─── Member Card ───────────────────────────────────────────────────────────────
function MemberCard({
  m, onEdit, onToggle, onDelete,
}: {
  m: TeamMember;
  onEdit: (m: TeamMember) => void;
  onToggle: (m: TeamMember) => void;
  onDelete: (id: string, name: string) => void;
}) {
  const roleInfo = ROLES[m.role] || ROLES.other;
  return (
    <div className={`bg-white rounded-xl border p-4 flex items-center gap-4 transition ${m.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
      {/* Avatar */}
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${m.is_active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
        {m.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-800">{m.full_name}</p>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${roleInfo.color}`}>{roleInfo.label}</span>
          {!m.is_active && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">INACTIVE</span>}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {m.cell_phone && (
            <a href={`tel:${m.cell_phone}`} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
              <Phone className="w-3 h-3" />{m.cell_phone}
            </a>
          )}
          {m.email && (
            <a href={`mailto:${m.email}`} className="flex items-center gap-1 text-xs text-gray-500 hover:underline">
              <Mail className="w-3 h-3" />{m.email}
            </a>
          )}
          {m.notes && <span className="text-xs text-gray-400">• {m.notes}</span>}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button type="button" onClick={() => onEdit(m)} title="Edit"
          onKeyDown={e => { if (e.key === ' ') e.preventDefault(); }}
          className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition">
          <Edit3 className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => onToggle(m)} title={m.is_active ? 'Deactivate' : 'Activate'}
          onKeyDown={e => { if (e.key === ' ') e.preventDefault(); }}
          className={`p-1.5 rounded-lg transition ${m.is_active ? 'hover:bg-yellow-50 text-yellow-600' : 'hover:bg-green-50 text-green-600'}`}>
          <Shield className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => onDelete(m.id, m.full_name)} title="Delete"
          onKeyDown={e => { if (e.key === ' ') e.preventDefault(); }}
          className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
