'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Calculator, FileText, ExternalLink, Upload, Download, Plus,
  Save, Trash2, Edit3, CheckCircle, Clock, AlertCircle, Copy,
  ChevronDown, ChevronUp, RefreshCw, Home, Layers, DollarSign,
  FileCheck, Clipboard, Hash, Percent, Info, X, Check,
  BarChart2, PenTool, Package, ArrowRight, Link as LinkIcon,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface XactimateData {
  id?: string;
  job_id: string;
  user_id: string;
  // Claim / File refs
  xact_claim_number: string;
  xact_file_number: string;
  xact_policy_number: string;
  // Adjuster
  adjuster_company: string;
  adjuster_name: string;
  adjuster_email: string;
  adjuster_phone: string;
  // Estimate summary
  estimate_status: 'not_started' | 'in_progress' | 'submitted' | 'approved' | 'supplement' | 'closed';
  rcv_total: string;
  acv_total: string;
  depreciation: string;
  deductible: string;
  overhead_profit: string;
  // Rooms / scope summary (JSON stored as text)
  scope_notes: string;
  // ESX / file tracking
  esx_file_name: string;
  esx_exported_at: string;
  esx_imported_to_xact: boolean;
  // XactAnalysis
  xactanalysis_job_id: string;
  xactanalysis_status: string;
  xactanalysis_last_sync: string;
  // Supplement tracking
  supplement_number: string;
  supplement_reason: string;
  // Timestamps
  created_at?: string;
  updated_at?: string;
}

interface LineItem {
  id: string;
  category: string;
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  rcv: string;
  room: string;
  notes: string;
}

const DEFAULT_FORM: Omit<XactimateData, 'id' | 'created_at' | 'updated_at'> = {
  job_id: '', user_id: '',
  xact_claim_number: '', xact_file_number: '', xact_policy_number: '',
  adjuster_company: '', adjuster_name: '', adjuster_email: '', adjuster_phone: '',
  estimate_status: 'not_started',
  rcv_total: '', acv_total: '', depreciation: '', deductible: '', overhead_profit: '',
  scope_notes: '',
  esx_file_name: '', esx_exported_at: '', esx_imported_to_xact: false,
  xactanalysis_job_id: '', xactanalysis_status: '', xactanalysis_last_sync: '',
  supplement_number: '', supplement_reason: '',
};

const ESTIMATE_STATUSES: { value: XactimateData['estimate_status']; label: string; color: string; icon: string }[] = [
  { value: 'not_started',  label: 'Not Started',   color: 'bg-slate-700/50 text-slate-400', icon: '⏳' },
  { value: 'in_progress',  label: 'In Progress',   color: 'bg-blue-100 text-blue-700',     icon: '✏️' },
  { value: 'submitted',    label: 'Submitted',      color: 'bg-yellow-100 text-yellow-700', icon: '📤' },
  { value: 'approved',     label: 'Approved',       color: 'bg-green-100 text-green-700',   icon: '✅' },
  { value: 'supplement',   label: 'Supplement',     color: 'bg-orange-100 text-orange-700', icon: '🔄' },
  { value: 'closed',       label: 'Closed',         color: 'bg-slate-700/50 text-slate-300', icon: '🔒' },
];

const LINE_ITEM_CATEGORIES = [
  'Mitigation', 'Demolition', 'Drywall', 'Painting', 'Flooring', 'Cabinetry',
  'Electrical', 'Plumbing', 'HVAC', 'Cleaning', 'Contents', 'Roofing',
  'Structural', 'Insulation', 'Windows/Doors', 'Other',
];

const UNIT_OPTIONS = ['EA', 'SF', 'LF', 'SY', 'HR', 'LS', 'CF', 'BF', 'SQ', 'CY'];

const ROOM_NAMES = [
  'Living Room', 'Kitchen', 'Master Bedroom', 'Bedroom 2', 'Bedroom 3',
  'Bathroom', 'Master Bathroom', 'Basement', 'Garage', 'Hallway',
  'Dining Room', 'Laundry Room', 'Office', 'Attic', 'Crawlspace',
  'Exterior', 'Entire Structure', 'Multiple Rooms',
];

// ─── Helper: Currency formatter ───────────────────────────────────────────────
function formatCurrency(val: string): string {
  const num = parseFloat(val.replace(/[^0-9.-]/g, ''));
  if (isNaN(num)) return val;
  return num.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2 });
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: XactimateData['estimate_status'] }) {
  const s = ESTIMATE_STATUSES.find(x => x.value === status);
  if (!s) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.color}`}>
      {s.icon} {s.label}
    </span>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────
function Section({
  title, icon: Icon, color = 'blue', children, collapsible = false, defaultOpen = true,
}: {
  title: string; icon: React.ElementType; color?: string; children: React.ReactNode;
  collapsible?: boolean; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const colors: Record<string, string> = {
    blue: 'text-blue-400', green: 'text-green-400', yellow: 'text-yellow-400',
    orange: 'text-orange-400', purple: 'text-purple-400', cyan: 'text-cyan-400',
    red: 'text-red-400', slate: 'text-slate-400',
  };
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden">
      <div
        className={`flex items-center justify-between px-4 py-3 border-b border-slate-700/50 ${collapsible ? 'cursor-pointer hover:bg-slate-700/30' : ''}`}
        onClick={collapsible ? () => setOpen(o => !o) : undefined}
      >
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${colors[color] || colors.blue}`} />
          <span className="text-sm font-semibold text-slate-200">{title}</span>
        </div>
        {collapsible && (open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />)}
      </div>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}

// ─── Input Field ──────────────────────────────────────────────────────────────
function Field({
  label, value, onChange, placeholder = '', type = 'text', mono = false, className = '',
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; mono?: boolean; className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-xs font-medium text-slate-400">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`px-3 py-2 rounded-lg border border-slate-600 bg-slate-900/60 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition ${mono ? 'font-mono' : ''}`}
      />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function JobXactimateTab({ jobId, userId }: { jobId: string; userId: string }) {
  const [data, setData]             = useState<XactimateData | null>(null);
  const [form, setForm]             = useState<Omit<XactimateData, 'id' | 'created_at' | 'updated_at'>>({ ...DEFAULT_FORM, job_id: jobId, user_id: userId });
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saveMsg, setSaveMsg]       = useState('');
  const [lineItems, setLineItems]   = useState<LineItem[]>([]);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [newItem, setNewItem]       = useState<Partial<LineItem>>({});
  const [showAddItem, setShowAddItem] = useState(false);
  const [copied, setCopied]         = useState('');
  const [activeView, setActiveView] = useState<'dashboard' | 'scope' | 'lineitems' | 'supplement'>('dashboard');

  // ── Load existing data ───────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: rows } = await supabase
      .from('xactimate_data')
      .select('*')
      .eq('job_id', jobId)
      .single();

    if (rows) {
      setData(rows);
      setForm({ ...rows });
      // Parse line items
      try {
        const li = JSON.parse(rows.scope_notes_json || '[]');
        setLineItems(li);
      } catch { setLineItems([]); }
    }
    setLoading(false);
  }, [jobId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    const payload = {
      ...form,
      job_id: jobId,
      user_id: userId,
      scope_notes_json: JSON.stringify(lineItems),
      updated_at: new Date().toISOString(),
    };

    let error;
    if (data?.id) {
      ({ error } = await supabase.from('xactimate_data').update(payload).eq('id', data.id));
    } else {
      const { data: inserted, error: err } = await supabase.from('xactimate_data').insert([payload]).select().single();
      if (inserted) setData(inserted);
      error = err;
    }

    if (error) {
      setSaveMsg(`❌ Error: ${error.message}`);
    } else {
      setSaveMsg('✅ Saved');
      setTimeout(() => setSaveMsg(''), 3000);
    }
    setSaving(false);
  };

  // ── Copy to clipboard ─────────────────────────────────────────────────────
  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  // ── Line Items helpers ────────────────────────────────────────────────────
  const addLineItem = () => {
    if (!newItem.description) return;
    const item: LineItem = {
      id: Date.now().toString(),
      category: newItem.category || 'Other',
      description: newItem.description || '',
      quantity: newItem.quantity || '1',
      unit: newItem.unit || 'EA',
      unit_price: newItem.unit_price || '0',
      rcv: (parseFloat(newItem.quantity || '1') * parseFloat(newItem.unit_price || '0')).toFixed(2),
      room: newItem.room || '',
      notes: newItem.notes || '',
    };
    setLineItems(prev => [...prev, item]);
    setNewItem({});
    setShowAddItem(false);
  };

  const removeLineItem = (id: string) => {
    setLineItems(prev => prev.filter(x => x.id !== id));
  };

  const totalRCV = lineItems.reduce((sum, li) => sum + parseFloat(li.rcv || '0'), 0);

  // ── Status helpers ────────────────────────────────────────────────────────
  const currentStatus = ESTIMATE_STATUSES.find(s => s.value === form.estimate_status)!;

  const setField = (key: keyof typeof form, val: string | boolean) =>
    setForm(prev => ({ ...prev, [key]: val }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
        <span className="ml-3 text-slate-400 text-sm">Loading Xactimate data…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-10">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
            <Calculator className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">Xactimate Dashboard</h2>
            <p className="text-xs text-slate-400">Track estimates, scope, and claim data</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={form.estimate_status} />
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {saveMsg && (
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${saveMsg.startsWith('✅') ? 'bg-green-900/40 text-green-300 border border-green-700/50' : 'bg-red-900/40 text-red-300 border border-red-700/50'}`}>
          {saveMsg}
        </div>
      )}

      {/* ── Quick Stats Bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'RCV Total',      value: form.rcv_total      ? formatCurrency(form.rcv_total)      : '—', icon: DollarSign, color: 'text-green-400',  bg: 'bg-green-900/20 border-green-700/30'  },
          { label: 'ACV Total',      value: form.acv_total      ? formatCurrency(form.acv_total)      : '—', icon: DollarSign, color: 'text-blue-400',   bg: 'bg-blue-900/20 border-blue-700/30'   },
          { label: 'Deductible',     value: form.deductible     ? formatCurrency(form.deductible)     : '—', icon: Percent,    color: 'text-yellow-400', bg: 'bg-yellow-900/20 border-yellow-700/30'},
          { label: 'O&P',            value: form.overhead_profit? formatCurrency(form.overhead_profit): '—', icon: BarChart2,  color: 'text-purple-400', bg: 'bg-purple-900/20 border-purple-700/30'},
        ].map(stat => (
          <div key={stat.label} className={`rounded-xl border p-3 ${stat.bg}`}>
            <div className="flex items-center gap-2 mb-1">
              <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
              <span className="text-xs text-slate-400 font-medium">{stat.label}</span>
            </div>
            <p className={`text-base font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* ── Sub-nav ── */}
      <div className="flex gap-1 bg-slate-800/60 border border-slate-700/50 rounded-xl p-1">
        {[
          { id: 'dashboard',    label: 'Claim Info',    icon: FileText   },
          { id: 'scope',        label: 'Scope Notes',   icon: Clipboard  },
          { id: 'lineitems',    label: 'Line Items',    icon: Layers     },
          { id: 'supplement',   label: 'Supplement',    icon: PenTool    },
        ].map(v => (
          <button
            key={v.id}
            onClick={() => setActiveView(v.id as typeof activeView)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition flex-1 justify-center ${
              activeView === v.id
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
          >
            <v.icon className="w-3.5 h-3.5" />
            {v.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════
          VIEW: CLAIM INFO / DASHBOARD
      ════════════════════════════════════════════════════════ */}
      {activeView === 'dashboard' && (
        <div className="space-y-4">

          {/* Claim Reference Numbers */}
          <Section title="Claim & File Numbers" icon={Hash} color="cyan">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-400">Xactimate Claim #</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.xact_claim_number}
                    onChange={e => setField('xact_claim_number', e.target.value)}
                    placeholder="e.g. 2025-CLM-001234"
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-600 bg-slate-900/60 text-slate-200 text-sm font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                  {form.xact_claim_number && (
                    <button onClick={() => copyText(form.xact_claim_number, 'claim')}
                      className="px-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition">
                      {copied === 'claim' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>
              <Field label="Xactimate File #" value={form.xact_file_number} onChange={v => setField('xact_file_number', v)} placeholder="File number" mono />
              <Field label="Policy Number" value={form.xact_policy_number} onChange={v => setField('xact_policy_number', v)} placeholder="Policy #" mono />
            </div>
          </Section>

          {/* Estimate Status */}
          <Section title="Estimate Status" icon={FileCheck} color="green">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ESTIMATE_STATUSES.map(s => (
                <button
                  key={s.value}
                  onClick={() => setField('estimate_status', s.value)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition ${
                    form.estimate_status === s.value
                      ? `${s.color} border-current shadow-lg scale-105`
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  <span>{s.icon}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </Section>

          {/* Adjuster Information */}
          <Section title="Adjuster / IA Info" icon={Package} color="purple" collapsible defaultOpen>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Adjuster Company"  value={form.adjuster_company}  onChange={v => setField('adjuster_company', v)}  placeholder="e.g. Crawford & Company" />
              <Field label="Adjuster Name"     value={form.adjuster_name}     onChange={v => setField('adjuster_name', v)}     placeholder="Full name" />
              <Field label="Adjuster Email"    value={form.adjuster_email}    onChange={v => setField('adjuster_email', v)}    placeholder="adjuster@company.com" type="email" />
              <Field label="Adjuster Phone"    value={form.adjuster_phone}    onChange={v => setField('adjuster_phone', v)}    placeholder="(416) 555-0000" type="tel" />
            </div>
            {form.adjuster_email && (
              <div className="flex gap-2 mt-3">
                <a href={`mailto:${form.adjuster_email}?subject=Re: Claim ${form.xact_claim_number || 'File'}`}
                  className="flex items-center gap-1.5 text-xs bg-purple-900/30 hover:bg-purple-800/30 text-purple-300 border border-purple-700/40 px-3 py-1.5 rounded-lg transition">
                  ✉️ Email Adjuster
                </a>
                {form.adjuster_phone && (
                  <a href={`tel:${form.adjuster_phone}`}
                    className="flex items-center gap-1.5 text-xs bg-blue-900/30 hover:bg-blue-800/30 text-cyan-300 border border-blue-700/40 px-3 py-1.5 rounded-lg transition">
                    📞 Call Adjuster
                  </a>
                )}
              </div>
            )}
          </Section>

          {/* Estimate Totals */}
          <Section title="Estimate Totals" icon={DollarSign} color="green" collapsible defaultOpen>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="RCV Total ($)" value={form.rcv_total} onChange={v => setField('rcv_total', v)} placeholder="0.00" type="number" />
              <Field label="ACV Total ($)" value={form.acv_total} onChange={v => setField('acv_total', v)} placeholder="0.00" type="number" />
              <Field label="Depreciation ($)" value={form.depreciation} onChange={v => setField('depreciation', v)} placeholder="0.00" type="number" />
              <Field label="Deductible ($)" value={form.deductible} onChange={v => setField('deductible', v)} placeholder="0.00" type="number" />
              <Field label="Overhead & Profit ($)" value={form.overhead_profit} onChange={v => setField('overhead_profit', v)} placeholder="0.00" type="number" />
            </div>
            {/* Computed summary */}
            {(form.rcv_total || form.acv_total) && (
              <div className="mt-3 bg-slate-900/60 rounded-xl border border-slate-700/50 p-3 grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between text-slate-400 col-span-2 pb-1 border-b border-slate-700/50">
                  <span className="font-semibold text-slate-300">Net Payout Estimate</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">RCV</span>
                  <span className="text-green-300 font-mono">{formatCurrency(form.rcv_total || '0')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Deductible</span>
                  <span className="text-red-300 font-mono">- {formatCurrency(form.deductible || '0')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">ACV Payment</span>
                  <span className="text-blue-300 font-mono">{formatCurrency(form.acv_total || '0')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">O&P</span>
                  <span className="text-purple-300 font-mono">{formatCurrency(form.overhead_profit || '0')}</span>
                </div>
              </div>
            )}
          </Section>

          {/* ESX File Tracking */}
          <Section title="ESX File Export (Xactimate Import)" icon={Download} color="orange" collapsible defaultOpen={false}>
            <div className="space-y-3">
              <p className="text-xs text-slate-400 bg-orange-900/20 border border-orange-700/30 rounded-lg p-3">
                <strong className="text-orange-300">How it works:</strong> Export your scope data from RoomLens using the ESX format below,
                then import it into Xactimate Desktop (File → Import ESX) or upload to XactAnalysis.
                Track the file name and import status here.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="ESX File Name" value={form.esx_file_name} onChange={v => setField('esx_file_name', v)} placeholder="e.g. CLM-001234-scope.esx" mono />
                <Field label="Exported At" value={form.esx_exported_at} onChange={v => setField('esx_exported_at', v)} type="datetime-local" />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setField('esx_imported_to_xact', !form.esx_imported_to_xact)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-semibold transition ${
                    form.esx_imported_to_xact
                      ? 'bg-green-900/30 border-green-600 text-green-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-green-600'
                  }`}
                >
                  {form.esx_imported_to_xact ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                  {form.esx_imported_to_xact ? 'Imported to Xactimate ✓' : 'Mark as Imported to Xactimate'}
                </button>
              </div>
            </div>
          </Section>

          {/* XactAnalysis */}
          <Section title="XactAnalysis (Carrier Portal)" icon={LinkIcon} color="cyan" collapsible defaultOpen={false}>
            <div className="space-y-3">
              <p className="text-xs text-slate-400 bg-cyan-900/20 border border-cyan-700/30 rounded-lg p-3">
                <strong className="text-cyan-300">XactAnalysis</strong> is the carrier portal where insurers like Intact, Aviva, and Commonwell
                send jobs to your company. Record the XactAnalysis Job ID and status here for reference.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="XactAnalysis Job ID" value={form.xactanalysis_job_id} onChange={v => setField('xactanalysis_job_id', v)} placeholder="XA-12345" mono />
                <Field label="XactAnalysis Status" value={form.xactanalysis_status} onChange={v => setField('xactanalysis_status', v)} placeholder="e.g. Pending Review" />
              </div>
              <Field label="Last Sync / Update Date" value={form.xactanalysis_last_sync} onChange={v => setField('xactanalysis_last_sync', v)} type="date" />
              <a
                href="https://www.xactanalysis.com"
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs bg-cyan-900/30 hover:bg-cyan-800/30 text-cyan-300 border border-cyan-700/40 px-3 py-2 rounded-lg transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open XactAnalysis Portal
              </a>
            </div>
          </Section>

          {/* Open Xactimate Desktop Shortcut */}
          <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-700/40 rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600/30 rounded-xl flex items-center justify-center">
                <Calculator className="w-5 h-5 text-blue-300" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-200">Open Xactimate</p>
                <p className="text-xs text-slate-400">Launch Xactimate desktop or web app to build your estimate.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <a href="https://xactimate.com" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition">
                <ExternalLink className="w-3.5 h-3.5" />
                Web App
              </a>
              <a href="xactimate://" 
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold rounded-lg transition"
                title="Attempts to launch Xactimate desktop app">
                <ArrowRight className="w-3.5 h-3.5" />
                Desktop
              </a>
            </div>
          </div>

        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          VIEW: SCOPE NOTES
      ════════════════════════════════════════════════════════ */}
      {activeView === 'scope' && (
        <div className="space-y-4">
          <Section title="Scope of Work Notes" icon={Clipboard} color="yellow">
            <p className="text-xs text-slate-400 mb-3">
              Document the full scope of work here — room-by-room damage summary, materials to replace/restore,
              and any special conditions. These notes feed into your Xactimate line items.
            </p>
            <textarea
              value={form.scope_notes}
              onChange={e => setField('scope_notes', e.target.value)}
              placeholder={`Room-by-room scope summary:\n\nLiving Room:\n• Remove & replace 250 SF drywall (cat 3 contamination)\n• Remove 180 SF flooring\n• Remove & replace base trim\n\nKitchen:\n• Dry out cabinets — 2 base units affected\n• Remove & replace 25 SF vinyl flooring\n\nBasement:\n• Remove 400 SF drywall to 4' height\n• Remove insulation behind drywall…`}
              rows={16}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-600 bg-slate-900/60 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-y font-mono leading-relaxed"
            />
            <div className="flex justify-between items-center mt-2 text-xs text-slate-500">
              <span>{form.scope_notes.length} chars</span>
              <button
                onClick={() => copyText(form.scope_notes, 'scope')}
                className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition"
              >
                {copied === 'scope' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                Copy scope
              </button>
            </div>
          </Section>

          {/* Xactimate Tips */}
          <Section title="Xactimate Entry Tips" icon={Info} color="blue" collapsible defaultOpen={false}>
            <div className="space-y-2 text-xs text-slate-400">
              {[
                { tip: 'Cat 2/3 Water', detail: 'Always add "Treat – Anti-microbial application" line item per affected room' },
                { tip: 'Drywall Replacement', detail: 'Measure to nearest 0.1 SF. Use DRY for drywall, not DRYWALL (different unit)' },
                { tip: 'O&P', detail: 'General contractors qualify for 10/10 O&P when 3+ trades are involved' },
                { tip: 'Detach & Reset vs Replace', detail: 'D&R on doors, fixtures and trim whenever you aren\'t replacing the item' },
                { tip: 'Contents Line Items', detail: 'Use ALE (Additional Living Expenses) for hotel costs; log under Coverage D' },
                { tip: 'Equipment', detail: 'Log dehu/fan days under Equipment Rental — match to your moisture logs exactly' },
                { tip: 'Photos', detail: 'Xactimate requires photos to match every major line item — use RoomLens Photos tab' },
              ].map(t => (
                <div key={t.tip} className="flex gap-2 bg-slate-800/60 rounded-lg p-2.5 border border-slate-700/40">
                  <span className="text-blue-300 font-semibold shrink-0">💡 {t.tip}:</span>
                  <span>{t.detail}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          VIEW: LINE ITEMS
      ════════════════════════════════════════════════════════ */}
      {activeView === 'lineitems' && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="flex items-center justify-between bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3">
            <div>
              <p className="text-xs text-slate-400">Line Items Total RCV</p>
              <p className="text-xl font-bold text-green-300">{formatCurrency(totalRCV.toString())}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">{lineItems.length} items</p>
              <p className="text-xs text-slate-500">Rooms: {Array.from(new Set(lineItems.map(l => l.room).filter(Boolean))).length}</p>
            </div>
          </div>

          {/* Line item table */}
          {lineItems.length > 0 ? (
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700/50 text-xs text-slate-400 uppercase">
                      <th className="text-left px-4 py-2 font-semibold">Category</th>
                      <th className="text-left px-4 py-2 font-semibold">Description</th>
                      <th className="text-left px-4 py-2 font-semibold">Room</th>
                      <th className="text-right px-4 py-2 font-semibold">Qty</th>
                      <th className="text-left px-4 py-2 font-semibold">Unit</th>
                      <th className="text-right px-4 py-2 font-semibold">Unit $</th>
                      <th className="text-right px-4 py-2 font-semibold">RCV</th>
                      <th className="px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, idx) => (
                      <tr key={item.id} className={`border-b border-slate-700/30 hover:bg-slate-700/20 transition ${idx % 2 === 0 ? '' : 'bg-slate-900/20'}`}>
                        <td className="px-4 py-2.5 text-slate-400 text-xs">{item.category}</td>
                        <td className="px-4 py-2.5 text-slate-200 text-xs max-w-[200px] truncate" title={item.description}>{item.description}</td>
                        <td className="px-4 py-2.5 text-slate-400 text-xs">{item.room || '—'}</td>
                        <td className="px-4 py-2.5 text-right text-slate-200 font-mono text-xs">{item.quantity}</td>
                        <td className="px-4 py-2.5 text-slate-400 text-xs">{item.unit}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-200">${item.unit_price}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold text-green-300">{formatCurrency(item.rcv)}</td>
                        <td className="px-2 py-2.5">
                          <button onClick={() => removeLineItem(item.id)}
                            className="p-1 text-slate-500 hover:text-red-400 transition rounded">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-600">
                      <td colSpan={6} className="px-4 py-2.5 text-right text-xs font-bold text-slate-300 uppercase tracking-wide">Total RCV</td>
                      <td className="px-4 py-2.5 text-right font-bold font-mono text-green-300 text-sm">{formatCurrency(totalRCV.toString())}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-slate-500 text-sm bg-slate-800/30 rounded-xl border border-dashed border-slate-700">
              <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No line items yet. Add your first line item below.
            </div>
          )}

          {/* Add Line Item Form */}
          {showAddItem ? (
            <div className="bg-slate-800/60 border border-blue-700/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-200">Add Line Item</p>
                <button onClick={() => setShowAddItem(false)} className="p-1 text-slate-400 hover:text-slate-200">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className="text-xs text-slate-400 font-medium">Description *</label>
                  <input
                    type="text"
                    value={newItem.description || ''}
                    onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))}
                    placeholder="e.g. Remove & replace drywall"
                    className="px-3 py-2 rounded-lg border border-slate-600 bg-slate-900/60 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400 font-medium">Category</label>
                  <select
                    value={newItem.category || ''}
                    onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))}
                    className="px-3 py-2 rounded-lg border border-slate-600 bg-slate-900/60 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    <option value="">Select…</option>
                    {LINE_ITEM_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400 font-medium">Room</label>
                  <select
                    value={newItem.room || ''}
                    onChange={e => setNewItem(p => ({ ...p, room: e.target.value }))}
                    className="px-3 py-2 rounded-lg border border-slate-600 bg-slate-900/60 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    <option value="">Select room…</option>
                    {ROOM_NAMES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400 font-medium">Quantity</label>
                  <input
                    type="number"
                    value={newItem.quantity || ''}
                    onChange={e => setNewItem(p => ({ ...p, quantity: e.target.value }))}
                    placeholder="1"
                    className="px-3 py-2 rounded-lg border border-slate-600 bg-slate-900/60 text-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400 font-medium">Unit</label>
                  <select
                    value={newItem.unit || 'EA'}
                    onChange={e => setNewItem(p => ({ ...p, unit: e.target.value }))}
                    className="px-3 py-2 rounded-lg border border-slate-600 bg-slate-900/60 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400 font-medium">Unit Price ($)</label>
                  <input
                    type="number"
                    value={newItem.unit_price || ''}
                    onChange={e => {
                      const price = e.target.value;
                      const qty = newItem.quantity || '1';
                      setNewItem(p => ({
                        ...p,
                        unit_price: price,
                        rcv: (parseFloat(qty) * parseFloat(price || '0')).toFixed(2),
                      }));
                    }}
                    placeholder="0.00"
                    className="px-3 py-2 rounded-lg border border-slate-600 bg-slate-900/60 text-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
              </div>
              {newItem.quantity && newItem.unit_price && (
                <div className="text-right text-sm font-semibold text-green-300">
                  RCV: {formatCurrency(newItem.rcv || (parseFloat(newItem.quantity) * parseFloat(newItem.unit_price)).toFixed(2))}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowAddItem(false)}
                  className="px-3 py-2 bg-slate-700 text-slate-300 text-sm rounded-lg hover:bg-slate-600 transition">
                  Cancel
                </button>
                <button onClick={addLineItem}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition">
                  <Plus className="w-3.5 h-3.5" />
                  Add Item
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddItem(true)}
              className="flex items-center gap-2 w-full justify-center px-4 py-3 border-2 border-dashed border-slate-600 hover:border-blue-500 text-slate-400 hover:text-blue-300 text-sm font-medium rounded-xl transition"
            >
              <Plus className="w-4 h-4" />
              Add Line Item
            </button>
          )}

          {/* Export hint */}
          {lineItems.length > 0 && (
            <div className="bg-orange-900/20 border border-orange-700/30 rounded-xl p-3 text-xs text-orange-300 flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>To transfer to Xactimate:</strong> Save this data, then manually enter each line item into Xactimate Desktop or the web app.
                Use the Claim Info tab to record the ESX file name once exported.
              </span>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          VIEW: SUPPLEMENT
      ════════════════════════════════════════════════════════ */}
      {activeView === 'supplement' && (
        <div className="space-y-4">
          <Section title="Supplement Tracking" icon={PenTool} color="orange">
            <div className="space-y-3">
              <p className="text-xs text-slate-400 bg-orange-900/20 border border-orange-700/30 rounded-lg p-3">
                A <strong className="text-orange-300">supplement</strong> is an additional claim submission when your original estimate 
                didn&apos;t capture all damages, or when additional work was required during restoration. 
                Document the supplement number and reason here.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field
                  label="Supplement Number"
                  value={form.supplement_number}
                  onChange={v => setField('supplement_number', v)}
                  placeholder="e.g. Supplement #1, #2…"
                  mono
                />
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-400">Supplement Status</label>
                  <select
                    value={form.estimate_status === 'supplement' ? 'supplement' : ''}
                    onChange={e => {
                      if (e.target.value === 'supplement') setField('estimate_status', 'supplement');
                    }}
                    className="px-3 py-2 rounded-lg border border-slate-600 bg-slate-900/60 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    <option value="">Not in supplement phase</option>
                    <option value="supplement">Active Supplement</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-400">Supplement Reason / Description</label>
                <textarea
                  value={form.supplement_reason}
                  onChange={e => setField('supplement_reason', e.target.value)}
                  placeholder={`Describe why you are supplementing the original estimate:\n\nExample:\n• Hidden damage found behind drywall after demolition\n• Additional 3 days of equipment rental required\n• Mold remediation scope expanded to 2nd floor\n• Contents pack-out not included in original scope`}
                  rows={8}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-600 bg-slate-900/60 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-y"
                />
              </div>
            </div>
          </Section>

          {/* Common Supplement Reasons */}
          <Section title="Common Supplement Reasons (tap to add)" icon={Info} color="slate" collapsible defaultOpen={false}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                'Hidden mold found behind drywall during demolition',
                'Structural damage found after removing floor covering',
                'Additional equipment rental days required due to abnormal drying',
                'Contents pack-out and storage not included in original estimate',
                'Temporary power and lighting for safe work conditions',
                'HEPA vacuuming and negative air pressure containment (Cat 3)',
                'Asbestos/lead abatement required — not in original scope',
                'Additional trades required: electrician, plumber',
                'Permit fees and inspections not included in original scope',
                'Contents cleaning and deodorization added to scope',
              ].map(reason => (
                <button
                  key={reason}
                  onClick={() => setField('supplement_reason', form.supplement_reason ? `${form.supplement_reason}\n• ${reason}` : `• ${reason}`)}
                  className="text-left text-xs text-slate-300 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 hover:border-orange-600/50 rounded-lg px-3 py-2 transition"
                >
                  + {reason}
                </button>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* ── Save Button (bottom sticky) ── */}
      <div className="sticky bottom-4 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-lg transition disabled:opacity-50"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save All Changes'}
        </button>
      </div>

    </div>
  );
}
