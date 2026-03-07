'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Save, Loader2, AlertCircle, Zap } from 'lucide-react';
import Link from 'next/link';

const WORKFLOW_STEPS = [
  'File Creation', 'Dispatch', 'Work Authorization', 'Day-1 Evidence',
  'Content Inventory', 'Equipment Placement', '24-Hr Report', 'Floor Plan Scan',
  'Moisture Map Setup', 'Daily Drying Logs', 'Drying Goal Met', 'Equipment Removal',
  'Final Scope / Est.', 'Job Close Checklist', 'Invoicing & Close',
];

const LEAD_SOURCES = [
  { value: 'phone',         label: '📞 Phone Call'              },
  { value: 'ppc_ad',        label: '🎯 PPC Ad (Google/Meta)'    },
  { value: 'xactanalysis',  label: '📊 Xactanalysis'            },
  { value: 'referral',      label: '🤝 Referral'                },
  { value: 'repeat_client', label: '⭐ Repeat Client'           },
  { value: 'manual',        label: '✏️ Manual Entry'            },
  { value: 'other',         label: '📋 Other'                   },
];

const cls = 'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none';

export default function NewJobPage() {
  const router = useRouter();
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  // File-creation metadata (auto-filled from user profile)
  const [creator, setCreator] = useState({ name: '', phone: '', email: '' });

  const [form, setForm] = useState({
    lead_source: 'phone',
    lead_source_detail: '',
    insured_name: '',
    insured_phone: '',
    insured_email: '',
    property_address: '',
    property_city: '',
    property_postal_code: '',
    claim_number: '',
    insurer_name: '',
    loss_date: '',
    loss_category: '2',
    loss_class: '2',
    job_type: 'water_loss',
    adjuster_name: '',
    adjuster_email: '',
    adjuster_phone: '',
    notes: '',
  });

  const update = (k: keyof typeof form, v: string) =>
    setForm(prev => ({ ...prev, [k]: v }));

  // Auto-fetch user profile for "Created By" snapshot
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: profile } = await supabase
        .from('users')
        .select('full_name, company_name')
        .eq('id', session.user.id)
        .single();
      setCreator({
        name:  profile?.full_name  || session.user.user_metadata?.full_name  || '',
        phone: '',
        email: session.user.email || '',
      });
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.insured_name || !form.property_address) {
      setError('Insured name and property address are required.');
      return;
    }
    setLoading(true); setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .insert({
          user_id:              session.user.id,
          // Lead source (Step 1)
          lead_source:          form.lead_source,
          lead_source_detail:   form.lead_source_detail || null,
          // Created-by snapshot
          created_by_name:      creator.name  || null,
          created_by_phone:     creator.phone || null,
          created_by_email:     creator.email || null,
          // Insured
          insured_name:         form.insured_name,
          insured_phone:        form.insured_phone || null,
          insured_email:        form.insured_email || null,
          // Property
          property_address:     form.property_address,
          property_city:        form.property_city || null,
          property_postal_code: form.property_postal_code || null,
          // Claim
          claim_number:         form.claim_number || null,
          insurer_name:         form.insurer_name || null,
          loss_date:            form.loss_date || null,
          loss_category:        parseInt(form.loss_category),
          loss_class:           parseInt(form.loss_class),
          job_type:             form.job_type,
          // Adjuster
          adjuster_name:        form.adjuster_name || null,
          adjuster_email:       form.adjuster_email || null,
          adjuster_phone:       form.adjuster_phone || null,
          notes:                form.notes || null,
          status:               'new',
          current_step:         1,
        })
        .select('id')
        .single();

      if (jobError || !job) {
        setError(jobError?.message || 'Failed to create job.');
        return;
      }

      // Insert 15 workflow steps
      const workflowSteps = WORKFLOW_STEPS.map((name, i) => ({
        job_id:       job.id,
        step_number:  i + 1,
        step_name:    name,
        status:       i === 0 ? 'complete' : i === 1 ? 'in_progress' : 'pending',
        completed_at: i === 0 ? new Date().toISOString() : null,
        completed_by: i === 0 ? session.user.id : null,
      }));
      await supabase.from('workflow_steps').insert(workflowSteps);

      router.push(`/jobs/${job.id}`);
    } catch (err) {
      setError('Unexpected error. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ── shared label style
  const label = (text: string, required = false) => (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {text}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/jobs" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Job</h1>
          <p className="text-sm text-gray-500">Create a new restoration job file</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-5">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── STEP 1 CAPTURE: Lead Source ── */}
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-5">
          <h2 className="text-base font-semibold text-blue-800 mb-1 flex items-center gap-2">
            <Zap className="w-4 h-4" /> How did this job come in?
          </h2>
          <p className="text-xs text-blue-600 mb-4">This captures Step 1 — File Creation source tracking</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              {label('Lead Source', true)}
              <select value={form.lead_source} onChange={e => update('lead_source', e.target.value)}
                className={cls}>
                {LEAD_SOURCES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              {label('Source Detail')}
              <input type="text" value={form.lead_source_detail}
                onChange={e => update('lead_source_detail', e.target.value)}
                placeholder='e.g. "Google Ad – Water Damage Ottawa"'
                className={cls} />
            </div>
          </div>
          {/* Created by snapshot */}
          {creator.name && (
            <div className="mt-3 flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-blue-100 text-sm">
              <span className="text-xs text-gray-400 shrink-0">📋 File created by:</span>
              <span className="font-medium text-gray-700">{creator.name}</span>
              {creator.email && <span className="text-gray-400 text-xs">• {creator.email}</span>}
            </div>
          )}
        </div>

        {/* ── Insured Information ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
            Insured Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              {label('Insured Name', true)}
              <input type="text" value={form.insured_name}
                onChange={e => update('insured_name', e.target.value)}
                placeholder="John Smith" className={cls} />
            </div>
            <div>
              {label('Phone')}
              <input type="tel" value={form.insured_phone}
                onChange={e => update('insured_phone', e.target.value)}
                placeholder="(613) 555-0100" className={cls} />
            </div>
            <div>
              {label('Email')}
              <input type="email" value={form.insured_email}
                onChange={e => update('insured_email', e.target.value)}
                placeholder="john@email.com" className={cls} />
            </div>
          </div>
        </div>

        {/* ── Property Details ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
            Property Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              {label('Street Address', true)}
              <input type="text" value={form.property_address}
                onChange={e => update('property_address', e.target.value)}
                placeholder="123 Main St" className={cls} />
            </div>
            <div>
              {label('City')}
              <input type="text" value={form.property_city}
                onChange={e => update('property_city', e.target.value)}
                placeholder="Ottawa" className={cls} />
            </div>
            <div>
              {label('Postal Code')}
              <input type="text" value={form.property_postal_code}
                onChange={e => update('property_postal_code', e.target.value)}
                placeholder="K1A 0A6" className={cls} />
            </div>
          </div>
        </div>

        {/* ── Claim Details ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
            Claim Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              {label('Claim Number')}
              <input type="text" value={form.claim_number}
                onChange={e => update('claim_number', e.target.value)}
                placeholder="CLM-2026-001" className={cls} />
            </div>
            <div>
              {label('Insurer')}
              <input type="text" value={form.insurer_name}
                onChange={e => update('insurer_name', e.target.value)}
                placeholder="Intact Insurance" className={cls} />
            </div>
            <div>
              {label('Loss Date')}
              <input type="date" value={form.loss_date}
                onChange={e => update('loss_date', e.target.value)}
                className={cls} />
            </div>
            <div>
              {label('Job Type')}
              <select value={form.job_type} onChange={e => update('job_type', e.target.value)} className={cls}>
                <option value="water_loss">💧 Water Loss</option>
                <option value="fire_loss">🔥 Fire Loss</option>
                <option value="mold">🌿 Mold</option>
                <option value="large_loss">🏗️ Large Loss</option>
                <option value="other">📋 Other</option>
              </select>
            </div>
            <div>
              {label('Loss Category')}
              <select value={form.loss_category} onChange={e => update('loss_category', e.target.value)} className={cls}>
                <option value="1">Category 1 – Clean Water</option>
                <option value="2">Category 2 – Grey Water</option>
                <option value="3">Category 3 – Black Water</option>
              </select>
            </div>
            <div>
              {label('Loss Class')}
              <select value={form.loss_class} onChange={e => update('loss_class', e.target.value)} className={cls}>
                <option value="1">Class 1 – Least Affected</option>
                <option value="2">Class 2 – Significant Absorption</option>
                <option value="3">Class 3 – Greatest Absorption</option>
                <option value="4">Class 4 – Specialty Drying</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Adjuster ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
            Adjuster Information <span className="text-sm font-normal text-gray-400">(optional)</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              {label('Adjuster Name')}
              <input type="text" value={form.adjuster_name}
                onChange={e => update('adjuster_name', e.target.value)}
                placeholder="Jane Doe" className={cls} />
            </div>
            <div>
              {label('Adjuster Phone')}
              <input type="tel" value={form.adjuster_phone}
                onChange={e => update('adjuster_phone', e.target.value)}
                placeholder="(613) 555-0200" className={cls} />
            </div>
            <div className="sm:col-span-2">
              {label('Adjuster Email')}
              <input type="email" value={form.adjuster_email}
                onChange={e => update('adjuster_email', e.target.value)}
                placeholder="adj@insurer.com" className={cls} />
            </div>
          </div>
        </div>

        {/* ── Notes ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          {label('Notes')}
          <textarea value={form.notes} onChange={e => update('notes', e.target.value)}
            rows={3} placeholder="Initial observations, special instructions..."
            className={`${cls} resize-none`} />
        </div>

        {/* ── Submit ── */}
        <div className="flex gap-3 pb-6">
          <Link href="/jobs"
            className="flex-1 text-center py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition text-sm">
            Cancel
          </Link>
          <button type="submit" disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-lg transition text-sm">
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
              : <><Save className="w-4 h-4" /> Create Job</>
            }
          </button>
        </div>
      </form>
    </div>
  );
}
