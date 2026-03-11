'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Shield, Users, Building2, DollarSign, TrendingUp,
  Plus, Search, MoreVertical, CheckCircle, XCircle,
  AlertTriangle, Clock, Settings, LogOut, ChevronRight,
  BarChart2, CreditCard, Activity, Eye, Edit3, Ban,
  RefreshCw, Mail, Phone, Globe, Loader2, X, Save,
  Zap, Star, Package
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Tenant {
  id: string;
  slug: string;
  company_name: string;
  owner_email: string;
  owner_name: string | null;
  phone: string | null;
  plan: string;
  plan_price: number;
  status: string;
  max_users: number;
  max_jobs: number;
  trial_ends_at: string | null;
  next_billing_at: string | null;
  created_at: string;
  notes: string | null;
}

interface Stats {
  total: number;
  active: number;
  trial: number;
  suspended: number;
  mrr: number;
}

type TabType = 'overview' | 'tenants' | 'plans' | 'billing' | 'settings';

const PLAN_COLORS: Record<string, string> = {
  free:       'bg-slate-700 text-slate-300',
  starter:    'bg-blue-900/60 text-blue-300',
  pro:        'bg-purple-900/60 text-purple-300',
  enterprise: 'bg-yellow-900/60 text-yellow-300',
};

const STATUS_COLORS: Record<string, string> = {
  active:    'bg-green-900/60 text-green-300',
  trial:     'bg-cyan-900/60 text-cyan-300',
  suspended: 'bg-red-900/60 text-red-300',
  cancelled: 'bg-slate-700 text-slate-400',
};

// ═══════════════════════════════════════════════════════════════════════════════
export default function SuperAdminPage() {
  const router = useRouter();
  const [loading, setLoading]       = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [tab, setTab]               = useState<TabType>('overview');
  const [tenants, setTenants]       = useState<Tenant[]>([]);
  const [stats, setStats]           = useState<Stats>({ total: 0, active: 0, trial: 0, suspended: 0, mrr: 0 });
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [showNewTenant, setShowNewTenant]     = useState(false);
  const [saving, setSaving]         = useState(false);
  const [actionMsg, setActionMsg]   = useState('');

  // New tenant form
  const [newForm, setNewForm] = useState({
    company_name: '', slug: '', owner_email: '', owner_name: '',
    phone: '', plan: 'starter', status: 'trial', notes: ''
  });

  // ── Auth check — must be super admin ──────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const { data: sa } = await supabase
        .from('super_admins')
        .select('id')
        .eq('user_id', session.user.id)
        .single();

      if (!sa) {
        // Not a super admin — redirect to dashboard
        router.push('/dashboard');
        return;
      }
      setAuthorized(true);
      setLoading(false);
    })();
  }, [router]);

  const fetchTenants = useCallback(async () => {
    const { data } = await supabase
      .from('tenants')
      .select('*')
      .order('created_at', { ascending: false });
    const list = data || [];
    setTenants(list);
    setStats({
      total:     list.length,
      active:    list.filter(t => t.status === 'active').length,
      trial:     list.filter(t => t.status === 'trial').length,
      suspended: list.filter(t => t.status === 'suspended').length,
      mrr:       list.filter(t => t.status === 'active').reduce((s, t) => s + (t.plan_price || 0), 0),
    });
  }, []);

  useEffect(() => {
    if (authorized) fetchTenants();
  }, [authorized, fetchTenants]);

  // ── Create tenant ────────────────────────────────────────────────────────
  const createTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const slug = newForm.slug || newForm.company_name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const planPrices: Record<string, number> = { free: 0, starter: 49, pro: 99, enterprise: 199 };
    const { error } = await supabase.from('tenants').insert({
      ...newForm,
      slug,
      plan_price: planPrices[newForm.plan] || 0,
      trial_ends_at: newForm.status === 'trial' ? new Date(Date.now() + 14 * 86400000).toISOString() : null,
    });
    if (error) { setActionMsg(`Error: ${error.message}`); }
    else {
      setActionMsg(`✅ Tenant "${newForm.company_name}" created!`);
      setShowNewTenant(false);
      setNewForm({ company_name: '', slug: '', owner_email: '', owner_name: '', phone: '', plan: 'starter', status: 'trial', notes: '' });
      fetchTenants();
    }
    setSaving(false);
    setTimeout(() => setActionMsg(''), 4000);
  };

  // ── Update tenant status ─────────────────────────────────────────────────
  const updateStatus = async (id: string, status: string) => {
    await supabase.from('tenants').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    setActionMsg(`✅ Status updated to ${status}`);
    fetchTenants();
    setSelectedTenant(null);
    setTimeout(() => setActionMsg(''), 3000);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // ── Filtered tenants ────────────────────────────────────────────────────
  const filtered = tenants.filter(t => {
    const matchSearch = !search || t.company_name.toLowerCase().includes(search.toLowerCase()) || t.owner_email.toLowerCase().includes(search.toLowerCase()) || t.slug.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // ── Loading / unauthorized ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-400 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Verifying access...</p>
        </div>
      </div>
    );
  }
  if (!authorized) return null;

  return (
    <div className="min-h-screen bg-slate-900 flex">

      {/* ── Sidebar ── */}
      <aside className="w-60 bg-slate-800/80 border-r border-slate-700 flex flex-col">
        {/* Logo */}
        <div className="p-5 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">RoomLens</p>
              <p className="text-red-400 text-[10px] font-bold uppercase tracking-wider">Super Admin</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {([
            { id: 'overview', label: 'Overview',    icon: <BarChart2 className="w-4 h-4" /> },
            { id: 'tenants',  label: 'Tenants',     icon: <Building2 className="w-4 h-4" /> },
            { id: 'plans',    label: 'Plans',       icon: <Package className="w-4 h-4" /> },
            { id: 'billing',  label: 'Billing',     icon: <CreditCard className="w-4 h-4" /> },
            { id: 'settings', label: 'SA Settings', icon: <Settings className="w-4 h-4" /> },
          ] as { id: TabType; label: string; icon: React.ReactNode }[]).map(item => (
            <button key={item.id} onClick={() => setTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                tab === item.id ? 'bg-blue-600/20 text-blue-300 border border-blue-700/40' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}>
              {item.icon} {item.label}
            </button>
          ))}
        </nav>

        {/* Sign out */}
        <div className="p-3 border-t border-slate-700">
          <button onClick={signOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-700/50 transition">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 overflow-y-auto">

        {/* Top bar */}
        <div className="bg-slate-800/50 border-b border-slate-700 px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-lg capitalize">{tab}</h1>
            <p className="text-slate-400 text-xs">RoomLens Pro — Super Admin Console</p>
          </div>
          {actionMsg && (
            <div className={`text-sm px-4 py-2 rounded-lg font-medium ${actionMsg.startsWith('✅') ? 'bg-green-900/40 text-green-300 border border-green-700/40' : 'bg-red-900/40 text-red-300 border border-red-700/40'}`}>
              {actionMsg}
            </div>
          )}
        </div>

        <div className="p-8">

          {/* ══════ OVERVIEW ══════ */}
          {tab === 'overview' && (
            <div className="space-y-8">
              {/* Stat cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Tenants',    value: stats.total,     icon: <Building2 className="w-5 h-5" />,   color: 'text-blue-400',   bg: 'bg-blue-900/20' },
                  { label: 'Active',           value: stats.active,    icon: <CheckCircle className="w-5 h-5" />, color: 'text-green-400',  bg: 'bg-green-900/20' },
                  { label: 'In Trial',         value: stats.trial,     icon: <Clock className="w-5 h-5" />,       color: 'text-cyan-400',   bg: 'bg-cyan-900/20' },
                  { label: 'MRR',              value: `$${stats.mrr}`, icon: <DollarSign className="w-5 h-5" />, color: 'text-yellow-400', bg: 'bg-yellow-900/20' },
                ].map(card => (
                  <div key={card.label} className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                    <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center ${card.color} mb-3`}>
                      {card.icon}
                    </div>
                    <p className="text-2xl font-bold text-white">{card.value}</p>
                    <p className="text-slate-400 text-sm mt-0.5">{card.label}</p>
                  </div>
                ))}
              </div>

              {/* Recent tenants */}
              <div className="bg-slate-800 rounded-xl border border-slate-700">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
                  <h3 className="text-sm font-semibold text-white">Recent Tenants</h3>
                  <button onClick={() => setTab('tenants')} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    View all <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="divide-y divide-slate-700/50">
                  {tenants.slice(0, 5).map(t => (
                    <TenantRow key={t.id} tenant={t} onView={() => { setSelectedTenant(t); setShowTenantModal(true); }} />
                  ))}
                  {tenants.length === 0 && (
                    <div className="py-12 text-center">
                      <Building2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                      <p className="text-slate-400 text-sm">No tenants yet</p>
                      <button onClick={() => { setTab('tenants'); setShowNewTenant(true); }}
                        className="mt-3 text-xs text-blue-400 hover:text-blue-300 underline">
                        Create first tenant →
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Revenue chart placeholder */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-400" /> Revenue Overview
                </h3>
                <div className="h-32 flex items-end gap-2">
                  {[20, 35, 28, 50, 42, 65, 58, 80, 72, 95, 88, 100].map((h, i) => (
                    <div key={i} className="flex-1 bg-blue-600/30 rounded-t hover:bg-blue-600/50 transition"
                      style={{ height: `${h}%` }} title={`Month ${i + 1}`} />
                  ))}
                </div>
                <div className="flex justify-between mt-2 text-[10px] text-slate-500">
                  {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map(m => (
                    <span key={m}>{m}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══════ TENANTS ══════ */}
          {tab === 'tenants' && (
            <div className="space-y-5">
              {/* Toolbar */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search tenants..."
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                  className="py-2.5 px-3 bg-slate-700/50 border border-slate-600 rounded-lg text-sm text-white outline-none">
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="trial">Trial</option>
                  <option value="suspended">Suspended</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <button onClick={() => fetchTenants()}
                  className="p-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-400 hover:text-white transition">
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button onClick={() => setShowNewTenant(true)}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition">
                  <Plus className="w-4 h-4" /> New Tenant
                </button>
              </div>

              {/* New tenant form */}
              {showNewTenant && (
                <div className="bg-slate-800 rounded-xl border border-blue-700/40 p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-white font-semibold flex items-center gap-2">
                      <Plus className="w-4 h-4 text-blue-400" /> Create New Tenant
                    </h3>
                    <button onClick={() => setShowNewTenant(false)}><X className="w-4 h-4 text-slate-400 hover:text-white" /></button>
                  </div>
                  <form onSubmit={createTenant} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <SAField label="Company Name *">
                      <input required value={newForm.company_name}
                        onChange={e => setNewForm(p => ({ ...p, company_name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') }))}
                        placeholder="11 Restoration Inc." className={saInput} />
                    </SAField>
                    <SAField label="Subdomain Slug *">
                      <div className="flex items-center">
                        <input required value={newForm.slug}
                          onChange={e => setNewForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                          placeholder="11restoration" className={`${saInput} rounded-r-none`} />
                        <span className="px-3 py-2.5 bg-slate-700 border border-l-0 border-slate-600 rounded-r-lg text-xs text-slate-400 whitespace-nowrap">.roomlenspro.com</span>
                      </div>
                    </SAField>
                    <SAField label="Owner Email *">
                      <input required type="email" value={newForm.owner_email}
                        onChange={e => setNewForm(p => ({ ...p, owner_email: e.target.value }))}
                        placeholder="owner@company.com" className={saInput} />
                    </SAField>
                    <SAField label="Owner Name">
                      <input value={newForm.owner_name}
                        onChange={e => setNewForm(p => ({ ...p, owner_name: e.target.value }))}
                        placeholder="John Smith" className={saInput} />
                    </SAField>
                    <SAField label="Phone">
                      <input value={newForm.phone}
                        onChange={e => setNewForm(p => ({ ...p, phone: e.target.value }))}
                        placeholder="(555) 123-4567" className={saInput} />
                    </SAField>
                    <SAField label="Plan">
                      <select value={newForm.plan} onChange={e => setNewForm(p => ({ ...p, plan: e.target.value }))} className={saInput}>
                        <option value="free">Free</option>
                        <option value="starter">Starter — $49/mo</option>
                        <option value="pro">Pro — $99/mo</option>
                        <option value="enterprise">Enterprise — $199/mo</option>
                      </select>
                    </SAField>
                    <SAField label="Status">
                      <select value={newForm.status} onChange={e => setNewForm(p => ({ ...p, status: e.target.value }))} className={saInput}>
                        <option value="trial">Trial (14 days)</option>
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                      </select>
                    </SAField>
                    <SAField label="Internal Notes">
                      <input value={newForm.notes}
                        onChange={e => setNewForm(p => ({ ...p, notes: e.target.value }))}
                        placeholder="Referral source, notes..." className={saInput} />
                    </SAField>
                    <div className="sm:col-span-2 flex gap-3 pt-2">
                      <button type="submit" disabled={saving}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-semibold py-2.5 px-6 rounded-lg transition text-sm">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Create Tenant
                      </button>
                      <button type="button" onClick={() => setShowNewTenant(false)}
                        className="px-5 py-2.5 border border-slate-600 text-slate-400 hover:text-white rounded-lg text-sm transition">
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Tenant list */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-700 grid grid-cols-12 gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <span className="col-span-4">Company</span>
                  <span className="col-span-2">Plan</span>
                  <span className="col-span-2">Status</span>
                  <span className="col-span-2">Created</span>
                  <span className="col-span-2 text-right">Actions</span>
                </div>
                <div className="divide-y divide-slate-700/50">
                  {filtered.map(t => (
                    <TenantRow key={t.id} tenant={t} onView={() => { setSelectedTenant(t); setShowTenantModal(true); }} />
                  ))}
                  {filtered.length === 0 && (
                    <div className="py-12 text-center">
                      <p className="text-slate-400 text-sm">No tenants found</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══════ PLANS ══════ */}
          {tab === 'plans' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { name: 'Free',       price: '$0',    users: 1,   jobs: 5,   storage: '1 GB',    color: 'border-slate-600', badge: 'bg-slate-700 text-slate-300' },
                  { name: 'Starter',    price: '$49',   users: 3,   jobs: 25,  storage: '10 GB',   color: 'border-blue-700/50', badge: 'bg-blue-900/60 text-blue-300' },
                  { name: 'Pro',        price: '$99',   users: 10,  jobs: 999, storage: '50 GB',   color: 'border-purple-700/50', badge: 'bg-purple-900/60 text-purple-300' },
                  { name: 'Enterprise', price: '$199',  users: 25,  jobs: 999, storage: '200 GB',  color: 'border-yellow-700/50', badge: 'bg-yellow-900/60 text-yellow-300' },
                ].map(plan => (
                  <div key={plan.name} className={`bg-slate-800 rounded-xl border ${plan.color} p-5`}>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${plan.badge}`}>{plan.name}</span>
                    <p className="text-3xl font-bold text-white mt-3">{plan.price}<span className="text-slate-400 text-sm font-normal">/mo</span></p>
                    <div className="mt-4 space-y-2 text-sm text-slate-300">
                      <p>👤 {plan.users} user{plan.users > 1 ? 's' : ''}</p>
                      <p>📁 {plan.jobs === 999 ? 'Unlimited' : plan.jobs} jobs</p>
                      <p>💾 {plan.storage} storage</p>
                    </div>
                    <p className="text-xs text-slate-400 mt-4">
                      {tenants.filter(t => t.plan === plan.name.toLowerCase()).length} tenants on this plan
                    </p>
                  </div>
                ))}
              </div>
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-400" /> Add-on Pricing
                </h3>
                {[
                  { name: 'ClockInProof Integration', price: '+$29/mo', desc: 'GPS time tracking per job' },
                  { name: 'Encircle Integration',     price: '+$19/mo', desc: 'Field documentation sync' },
                  { name: 'Floor Plans (LiDAR)',       price: '+$39/mo', desc: 'Auto-generate floor plans' },
                  { name: 'Xactimate Export',          price: '+$49/mo', desc: 'One-click Xactimate export' },
                ].map(a => (
                  <div key={a.name} className="flex items-center justify-between py-3 border-b border-slate-700/50 last:border-0">
                    <div>
                      <p className="text-sm text-white font-medium">{a.name}</p>
                      <p className="text-xs text-slate-400">{a.desc}</p>
                    </div>
                    <span className="text-sm font-semibold text-slate-300">{a.price}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══════ BILLING ══════ */}
          {tab === 'billing' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Monthly Recurring Revenue</p>
                  <p className="text-3xl font-bold text-white">${stats.mrr}</p>
                  <p className="text-xs text-slate-500 mt-1">from {stats.active} active tenants</p>
                </div>
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Annual Run Rate</p>
                  <p className="text-3xl font-bold text-white">${stats.mrr * 12}</p>
                  <p className="text-xs text-slate-500 mt-1">projected ARR</p>
                </div>
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Avg Revenue Per Tenant</p>
                  <p className="text-3xl font-bold text-white">${stats.active > 0 ? Math.round(stats.mrr / stats.active) : 0}</p>
                  <p className="text-xs text-slate-500 mt-1">ARPU</p>
                </div>
              </div>
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-400" /> Recent Invoices
                </h3>
                <p className="text-slate-400 text-sm">Connect Stripe to see invoices here.</p>
                <button className="mt-3 flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 border border-blue-700/40 px-4 py-2 rounded-lg transition">
                  <Zap className="w-4 h-4" /> Connect Stripe
                </button>
              </div>
            </div>
          )}

          {/* ══════ SA SETTINGS ══════ */}
          {tab === 'settings' && (
            <div className="space-y-5 max-w-xl">
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-red-400" /> Super Admin Access
                </h3>
                <p className="text-slate-400 text-sm mb-4">Only users listed in the <code className="bg-slate-700 px-1.5 py-0.5 rounded text-xs">super_admins</code> table can access this panel.</p>
                <div className="bg-slate-700/50 rounded-lg p-4 text-sm font-mono text-slate-300 text-xs">
                  INSERT INTO super_admins (user_id, email)<br />
                  SELECT id, email FROM auth.users<br />
                  WHERE email = &apos;nasser.od@11restoration.com&apos;;
                </div>
                <p className="text-xs text-slate-500 mt-3">Run this in Supabase SQL Editor to grant access.</p>
              </div>
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-blue-400" /> Subdomain Setup
                </h3>
                <p className="text-slate-400 text-sm mb-3">Each tenant gets their own subdomain:</p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-slate-300">
                    <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                    <code className="bg-slate-700 px-2 py-0.5 rounded text-xs">11restoration.roomlenspro.com</code>
                    <span className="text-slate-500">→ Tenant staff dashboard</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                    <code className="bg-slate-700 px-2 py-0.5 rounded text-xs">roomlenspro.com/super-admin</code>
                    <span className="text-slate-500">→ This panel (you only)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ── Tenant Detail Modal ── */}
      {showTenantModal && selectedTenant && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-slate-700">
              <h3 className="text-white font-bold">{selectedTenant.company_name}</h3>
              <button onClick={() => { setShowTenantModal(false); setSelectedTenant(null); }}>
                <X className="w-5 h-5 text-slate-400 hover:text-white" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <InfoRow label="Slug" value={`${selectedTenant.slug}.roomlenspro.com`} />
                <InfoRow label="Plan" value={selectedTenant.plan} />
                <InfoRow label="Status" value={selectedTenant.status} />
                <InfoRow label="Owner" value={selectedTenant.owner_email} />
                <InfoRow label="Phone" value={selectedTenant.phone || '—'} />
                <InfoRow label="Created" value={new Date(selectedTenant.created_at).toLocaleDateString()} />
              </div>
              {selectedTenant.notes && (
                <div className="bg-slate-700/50 rounded-lg p-3 text-sm text-slate-300">
                  <p className="text-xs text-slate-400 mb-1">Notes</p>
                  {selectedTenant.notes}
                </div>
              )}
              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-2">
                <a href={`https://${selectedTenant.slug}.roomlenspro.com`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs bg-blue-600/20 text-blue-400 border border-blue-700/40 px-3 py-2 rounded-lg hover:bg-blue-600/30 transition">
                  <Eye className="w-3.5 h-3.5" /> View Site
                </a>
                {selectedTenant.status !== 'active' && (
                  <button onClick={() => updateStatus(selectedTenant.id, 'active')}
                    className="flex items-center gap-1.5 text-xs bg-green-600/20 text-green-400 border border-green-700/40 px-3 py-2 rounded-lg hover:bg-green-600/30 transition">
                    <CheckCircle className="w-3.5 h-3.5" /> Activate
                  </button>
                )}
                {selectedTenant.status !== 'suspended' && (
                  <button onClick={() => updateStatus(selectedTenant.id, 'suspended')}
                    className="flex items-center gap-1.5 text-xs bg-red-600/20 text-red-400 border border-red-700/40 px-3 py-2 rounded-lg hover:bg-red-600/30 transition">
                    <Ban className="w-3.5 h-3.5" /> Suspend
                  </button>
                )}
                {selectedTenant.status !== 'trial' && (
                  <button onClick={() => updateStatus(selectedTenant.id, 'trial')}
                    className="flex items-center gap-1.5 text-xs bg-cyan-600/20 text-cyan-400 border border-cyan-700/40 px-3 py-2 rounded-lg hover:bg-cyan-600/30 transition">
                    <Clock className="w-3.5 h-3.5" /> Set Trial
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────
const saInput = 'w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 outline-none transition';

function SAField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-white font-medium truncate">{value}</p>
    </div>
  );
}

function TenantRow({ tenant, onView }: { tenant: Tenant; onView: () => void }) {
  return (
    <div className="px-5 py-3 grid grid-cols-12 gap-2 items-center hover:bg-slate-700/20 transition">
      <div className="col-span-4">
        <p className="text-sm font-semibold text-white">{tenant.company_name}</p>
        <p className="text-xs text-slate-400">{tenant.slug}.roomlenspro.com</p>
      </div>
      <div className="col-span-2">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${PLAN_COLORS[tenant.plan] || 'bg-slate-700 text-slate-300'}`}>
          {tenant.plan}
        </span>
      </div>
      <div className="col-span-2">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[tenant.status] || 'bg-slate-700 text-slate-400'}`}>
          {tenant.status}
        </span>
      </div>
      <div className="col-span-2 text-xs text-slate-400">
        {new Date(tenant.created_at).toLocaleDateString()}
      </div>
      <div className="col-span-2 flex justify-end">
        <button onClick={onView}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition">
          <Eye className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
