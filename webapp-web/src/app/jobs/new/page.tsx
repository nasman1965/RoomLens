'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Save, Loader2, AlertCircle, Zap, Shield } from 'lucide-react';
import Link from 'next/link';
import { CarrierSelect } from '@/components/carriers/CarrierSelect';
import { CarrierProfile, CarrierSlug } from '@/types/carriers';

const WORKFLOW_STEPS = [
  'File Creation', 'Dispatch', 'Work Authorization', 'Day-1 Evidence',
  'Content Inventory', 'Equipment Placement', '24-Hr Report', 'Floor Plan Scan',
  'Moisture Map Setup', 'Daily Drying Logs', 'Drying Goal Met', 'Equipment Removal',
  'Final Scope / Est.', 'Job Close Checklist', 'Invoicing & Close',
];

const LEAD_SOURCES = [
  { value: 'phone',         label: '📞 Phone Call'           },
  { value: 'ppc_ad',        label: '🎯 PPC Ad (Google/Meta)' },
  { value: 'xactanalysis',  label: '📊 Xactanalysis'         },
  { value: 'referral',      label: '🤝 Referral'             },
  { value: 'repeat_client', label: '⭐ Repeat Client'        },
  { value: 'manual',        label: '✏️ Manual Entry'         },
  { value: 'other',         label: '📋 Other'                },
];

// Dark-theme input class
const cls = 'w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600/60 rounded-xl text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition';

// Section wrapper
function Section({ title, icon, children, accent = false }: {
  title: string; icon?: React.ReactNode; children: React.ReactNode; accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-5 ${
      accent
        ? 'bg-cyan-500/5 border-cyan-500/20'
        : 'bg-slate-800/60 border-slate-700/50'
    }`}>
      <h2 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${accent ? 'text-cyan-300' : 'text-white'}`}>
        {icon}
        {title}
      </h2>
      {children}
    </div>
  );
}

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
      {text}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

export default function NewJobPage() {
  const router = useRouter();
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [creator, setCreator] = useState({ name: '', phone: '', email: '' });
  const [selectedCarrier, setSelectedCarrier] = useState<CarrierProfile | null>(null);

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

  const handleCarrierSelect = (profile: CarrierProfile) => {
    setSelectedCarrier(profile);
    if (!form.insurer_name) update('insurer_name', profile.insurer_name);
  };

  const update = (k: keyof typeof form, v: string) =>
    setForm(prev => ({ ...prev, [k]: v }));

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
        name:  profile?.full_name || session.user.user_metadata?.full_name || '',
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
          lead_source:          form.lead_source,
          lead_source_detail:   form.lead_source_detail || null,
          created_by_name:      creator.name  || null,
          created_by_phone:     creator.phone || null,
          created_by_email:     creator.email || null,
          insured_name:         form.insured_name,
          insured_phone:        form.insured_phone || null,
          insured_email:        form.insured_email || null,
          property_address:     form.property_address,
          property_city:        form.property_city || null,
          property_postal_code: form.property_postal_code || null,
          claim_number:         form.claim_number || null,
          insurer_name:         form.insurer_name || null,
          carrier_slug:         selectedCarrier?.carrier_slug || null,
          loss_date:            form.loss_date || null,
          loss_category:        parseInt(form.loss_category),
          loss_class:           parseInt(form.loss_class),
          job_type:             form.job_type,
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

  return (
    <div className="p-5 lg:p-7 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/jobs"
          className="p-2 hover:bg-slate-700/60 rounded-xl transition text-slate-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">New Job</h1>
          <p className="text-sm text-slate-400">Create a new restoration job file</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/40 text-red-300 text-sm rounded-xl p-3.5 mb-5">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Lead Source */}
        <Section title="How did this job come in?" icon={<Zap className="w-4 h-4 text-cyan-400" />} accent>
          <p className="text-xs text-slate-500 mb-4">Captures Step 1 — File Creation source tracking</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label text="Lead Source" required />
              <select value={form.lead_source} onChange={e => update('lead_source', e.target.value)} className={cls}>
                {LEAD_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <Label text="Source Detail" />
              <input type="text" value={form.lead_source_detail}
                onChange={e => update('lead_source_detail', e.target.value)}
                placeholder='e.g. "Google Ad – Water Damage Ottawa"' className={cls} />
            </div>
          </div>
          {creator.name && (
            <div className="mt-3 flex items-center gap-2 bg-slate-700/40 rounded-lg px-3 py-2 text-xs border border-slate-600/40">
              <span className="text-slate-500 shrink-0">📋 File created by:</span>
              <span className="font-medium text-slate-300">{creator.name}</span>
              {creator.email && <span className="text-slate-500">• {creator.email}</span>}
            </div>
          )}
        </Section>

        {/* Insured Information */}
        <Section title="Insured Information">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label text="Insured Name" required />
              <input type="text" value={form.insured_name} onChange={e => update('insured_name', e.target.value)}
                placeholder="John Smith" className={cls} />
            </div>
            <div>
              <Label text="Phone" />
              <input type="tel" value={form.insured_phone} onChange={e => update('insured_phone', e.target.value)}
                placeholder="(613) 555-0100" className={cls} />
            </div>
            <div>
              <Label text="Email" />
              <input type="email" value={form.insured_email} onChange={e => update('insured_email', e.target.value)}
                placeholder="john@email.com" className={cls} />
            </div>
          </div>
        </Section>

        {/* Property Details */}
        <Section title="Property Details">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label text="Street Address" required />
              <input type="text" value={form.property_address} onChange={e => update('property_address', e.target.value)}
                placeholder="123 Main St" className={cls} />
            </div>
            <div>
              <Label text="City" />
              <input type="text" value={form.property_city} onChange={e => update('property_city', e.target.value)}
                placeholder="Ottawa" className={cls} />
            </div>
            <div>
              <Label text="Postal Code" />
              <input type="text" value={form.property_postal_code} onChange={e => update('property_postal_code', e.target.value)}
                placeholder="K1A 0A6" className={cls} />
            </div>
          </div>
        </Section>

        {/* Insurance Carrier */}
        <Section title="Insurance Carrier" icon={<Shield className="w-4 h-4 text-blue-400" />}>
          <p className="text-xs text-slate-500 mb-4">
            Select the carrier to load SLA timers, photo requirements &amp; carrier-specific checklist.
          </p>
          <CarrierSelect
            onCarrierSelect={handleCarrierSelect}
            defaultValue={selectedCarrier?.carrier_slug as CarrierSlug | undefined}
          />
          {selectedCarrier && (
            <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              {selectedCarrier.insurer_name} — SLA timers will start automatically
            </div>
          )}
        </Section>

        {/* Claim Details */}
        <Section title="Claim Details">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label text="Claim Number" />
              <input type="text" value={form.claim_number} onChange={e => update('claim_number', e.target.value)}
                placeholder="CLM-2026-001" className={cls} />
            </div>
            <div>
              <Label text="Insurer" />
              <input type="text" value={form.insurer_name} onChange={e => update('insurer_name', e.target.value)}
                placeholder="Intact Insurance" className={cls} />
            </div>
            <div>
              <Label text="Loss Date" />
              <input type="date" value={form.loss_date} onChange={e => update('loss_date', e.target.value)} className={cls} />
            </div>
            <div>
              <Label text="Job Type" />
              <select value={form.job_type} onChange={e => update('job_type', e.target.value)} className={cls}>
                <option value="water_loss">💧 Water Loss</option>
                <option value="fire_loss">🔥 Fire Loss</option>
                <option value="mold">🌿 Mold</option>
                <option value="large_loss">🏗️ Large Loss</option>
                <option value="other">📋 Other</option>
              </select>
            </div>
            <div>
              <Label text="Loss Category" />
              <select value={form.loss_category} onChange={e => update('loss_category', e.target.value)} className={cls}>
                <option value="1">Category 1 – Clean Water</option>
                <option value="2">Category 2 – Grey Water</option>
                <option value="3">Category 3 – Black Water</option>
              </select>
            </div>
            <div>
              <Label text="Loss Class" />
              <select value={form.loss_class} onChange={e => update('loss_class', e.target.value)} className={cls}>
                <option value="1">Class 1 – Least Affected</option>
                <option value="2">Class 2 – Significant Absorption</option>
                <option value="3">Class 3 – Greatest Absorption</option>
                <option value="4">Class 4 – Specialty Drying</option>
              </select>
            </div>
          </div>
        </Section>

        {/* Adjuster */}
        <Section title="Adjuster Information (optional)">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label text="Adjuster Name" />
              <input type="text" value={form.adjuster_name} onChange={e => update('adjuster_name', e.target.value)}
                placeholder="Jane Doe" className={cls} />
            </div>
            <div>
              <Label text="Adjuster Phone" />
              <input type="tel" value={form.adjuster_phone} onChange={e => update('adjuster_phone', e.target.value)}
                placeholder="(613) 555-0200" className={cls} />
            </div>
            <div className="sm:col-span-2">
              <Label text="Adjuster Email" />
              <input type="email" value={form.adjuster_email} onChange={e => update('adjuster_email', e.target.value)}
                placeholder="adj@insurer.com" className={cls} />
            </div>
          </div>
        </Section>

        {/* Notes */}
        <Section title="Notes">
          <textarea value={form.notes} onChange={e => update('notes', e.target.value)}
            rows={3} placeholder="Initial observations, special instructions..."
            className={`${cls} resize-none`} />
        </Section>

        {/* Submit */}
        <div className="flex gap-3 pb-6">
          <Link href="/jobs"
            className="flex-1 text-center py-2.5 border border-slate-600/50 text-slate-400 font-medium rounded-xl hover:bg-slate-800/60 hover:text-white transition text-sm">
            Cancel
          </Link>
          <button type="submit" disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 disabled:bg-cyan-700 text-slate-900 font-bold py-2.5 rounded-xl transition text-sm shadow-lg shadow-cyan-500/20">
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
