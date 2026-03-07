'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Save, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

const WORKFLOW_STEPS = [
  'File Creation',
  'Dispatch',
  'Work Authorization',
  'Day-1 Evidence',
  'Content Inventory',
  'Equipment Placement',
  '24-Hr Report',
  'Floor Plan Scan',
  'Moisture Map Setup',
  'Daily Drying Logs',
  'Drying Goal Met',
  'Equipment Removal',
  'Final Scope / Est.',
  'Job Close Checklist',
  'Invoicing & Close',
];

export default function NewJobPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
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
          user_id: session.user.id,
          insured_name: form.insured_name,
          insured_phone: form.insured_phone || null,
          insured_email: form.insured_email || null,
          property_address: form.property_address,
          property_city: form.property_city || null,
          property_postal_code: form.property_postal_code || null,
          claim_number: form.claim_number || null,
          insurer_name: form.insurer_name || null,
          loss_date: form.loss_date || null,
          loss_category: parseInt(form.loss_category),
          loss_class: parseInt(form.loss_class),
          job_type: form.job_type,
          adjuster_name: form.adjuster_name || null,
          adjuster_email: form.adjuster_email || null,
          adjuster_phone: form.adjuster_phone || null,
          notes: form.notes || null,
          status: 'new',
          current_step: 1,
        })
        .select('id')
        .single();

      if (jobError || !job) {
        setError(jobError?.message || 'Failed to create job.');
        return;
      }

      const workflowSteps = WORKFLOW_STEPS.map((name, i) => ({
        job_id: job.id,
        step_number: i + 1,
        step_name: name,
        status: i === 0 ? 'complete' : i === 1 ? 'in_progress' : 'pending',
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
        {/* Insured Information */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
            Insured Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Insured Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.insured_name}
                onChange={e => update('insured_name', e.target.value)}
                placeholder="John Smith"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={form.insured_phone}
                onChange={e => update('insured_phone', e.target.value)}
                placeholder="(604) 555-0100"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.insured_email}
                onChange={e => update('insured_email', e.target.value)}
                placeholder="john@email.com"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Property */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
            Property Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Street Address <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.property_address}
                onChange={e => update('property_address', e.target.value)}
                placeholder="123 Main St"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                value={form.property_city}
                onChange={e => update('property_city', e.target.value)}
                placeholder="Vancouver"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
              <input
                type="text"
                value={form.property_postal_code}
                onChange={e => update('property_postal_code', e.target.value)}
                placeholder="V6B 2W9"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Claim Details */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
            Claim Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Claim Number</label>
              <input
                type="text"
                value={form.claim_number}
                onChange={e => update('claim_number', e.target.value)}
                placeholder="CLM-2024-001"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Insurer</label>
              <input
                type="text"
                value={form.insurer_name}
                onChange={e => update('insurer_name', e.target.value)}
                placeholder="Intact Insurance"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Loss Date</label>
              <input
                type="date"
                value={form.loss_date}
                onChange={e => update('loss_date', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Job Type</label>
              <select
                value={form.job_type}
                onChange={e => update('job_type', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="water_loss">💧 Water Loss</option>
                <option value="fire_loss">🔥 Fire Loss</option>
                <option value="mold">🌿 Mold</option>
                <option value="large_loss">🏗️ Large Loss</option>
                <option value="other">📋 Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Loss Category</label>
              <select
                value={form.loss_category}
                onChange={e => update('loss_category', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="1">Category 1 – Clean Water</option>
                <option value="2">Category 2 – Grey Water</option>
                <option value="3">Category 3 – Black Water</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Loss Class</label>
              <select
                value={form.loss_class}
                onChange={e => update('loss_class', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="1">Class 1 – Least Affected</option>
                <option value="2">Class 2 – Significant Absorption</option>
                <option value="3">Class 3 – Greatest Absorption</option>
                <option value="4">Class 4 – Specialty Drying</option>
              </select>
            </div>
          </div>
        </div>

        {/* Adjuster */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
            Adjuster Information <span className="text-sm font-normal text-gray-400">(optional)</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Adjuster Name</label>
              <input
                type="text"
                value={form.adjuster_name}
                onChange={e => update('adjuster_name', e.target.value)}
                placeholder="Jane Doe"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Adjuster Phone</label>
              <input
                type="tel"
                value={form.adjuster_phone}
                onChange={e => update('adjuster_phone', e.target.value)}
                placeholder="(604) 555-0200"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Adjuster Email</label>
              <input
                type="email"
                value={form.adjuster_email}
                onChange={e => update('adjuster_email', e.target.value)}
                placeholder="jadj@insurer.com"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={e => update('notes', e.target.value)}
            rows={3}
            placeholder="Initial observations, special instructions..."
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
          />
        </div>

        {/* Submit */}
        <div className="flex gap-3 pb-6">
          <Link href="/jobs"
            className="flex-1 text-center py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition text-sm">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-lg transition text-sm"
          >
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
