'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { CarrierSelect } from '@/components/carriers/CarrierSelect';
import { CarrierChecklist } from '@/components/carriers/CarrierChecklist';
import { useCarrierMode } from '@/hooks/useCarrierMode';
import { CarrierProfile, CarrierSlug } from '@/types/carriers';
import {
  ArrowLeft, Shield, Clock, AlertTriangle, CheckCircle2,
  FileText, Loader2, AlertCircle, TrendingUp,
} from 'lucide-react';

interface Job {
  id: string;
  insured_name: string;
  property_address: string;
  insurer_name: string | null;
  carrier_slug: CarrierSlug | null;
  claim_number: string | null;
  status: string;
  loss_date: string | null;
}

// ── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
  icon: Icon, label, value, color, pulse,
}: {
  icon: React.ElementType; label: string; value: string | number; color: string; pulse?: boolean;
}) {
  return (
    <div className={`bg-white rounded-xl border p-4 flex items-center gap-3 ${pulse ? 'border-red-300 shadow-red-100 shadow-md' : 'border-gray-200'}`}>
      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '20' }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className={`text-xl font-bold ${pulse ? 'text-red-600' : 'text-gray-800'}`}>{value}</p>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function CarrierModePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [job, setJob] = useState<Job | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [activeCarrierSlug, setActiveCarrierSlug] = useState<CarrierSlug | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Carrier mode hook (loads checklist + SLA timers from Supabase)
  const {
    carrier,
    checklist,
    slaTimers,
    carrierFiles,
    isLoading: carrierLoading,
    error: carrierError,
    completionPct,
    overdueTimers,
    blockedItems,
    markItemComplete,
    uploadFile,
  } = useCarrierMode(id, activeCarrierSlug);

  // ── Load job ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchJob = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const { data, error } = await supabase
        .from('jobs')
        .select('id, insured_name, property_address, insurer_name, carrier_slug, claim_number, status, loss_date')
        .eq('id', id)
        .single();

      if (error || !data) {
        setPageError('Job not found.');
      } else {
        setJob(data as Job);
        if (data.carrier_slug) setActiveCarrierSlug(data.carrier_slug as CarrierSlug);
      }
      setPageLoading(false);
    };
    if (id) fetchJob();
  }, [id, router]);

  // ── Select / save carrier ─────────────────────────────────────────────────
  const handleCarrierSelect = async (profile: CarrierProfile) => {
    setActiveCarrierSlug(profile.carrier_slug);
  };

  const saveCarrierChoice = async () => {
    if (!job || !activeCarrierSlug) return;
    setSaving(true);
    await supabase
      .from('jobs')
      .update({ carrier_slug: activeCarrierSlug, updated_at: new Date().toISOString() })
      .eq('id', job.id);

    // Create SLA timers if not already present
    const existing = slaTimers.length;
    if (existing === 0 && carrier) {
      const now = Date.now();
      const timers = [];

      // Emergency contact timer
      timers.push({
        job_id: id,
        carrier_slug: activeCarrierSlug,
        timer_name: 'emergency_contact',
        deadline_at: new Date(now + carrier.emergency_contact_deadline_minutes * 60 * 1000).toISOString(),
        status: 'pending',
      });
      // Site arrival timer
      timers.push({
        job_id: id,
        carrier_slug: activeCarrierSlug,
        timer_name: 'site_arrival',
        deadline_at: new Date(now + carrier.site_arrival_deadline_minutes * 60 * 1000).toISOString(),
        status: 'pending',
      });
      // 24-hour report timer
      if (carrier.requires_24hr_report) {
        timers.push({
          job_id: id,
          carrier_slug: activeCarrierSlug,
          timer_name: '24hr_report',
          deadline_at: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
          status: 'pending',
        });
      }
      // Estimate submission timer
      timers.push({
        job_id: id,
        carrier_slug: activeCarrierSlug,
        timer_name: 'estimate_submission',
        deadline_at: new Date(now + carrier.estimate_deadline_hours * 60 * 60 * 1000).toISOString(),
        status: 'pending',
      });

      await supabase.from('carrier_sla_timers').insert(timers);
    }

    setJob(prev => prev ? { ...prev, carrier_slug: activeCarrierSlug } : prev);
    setSaving(false);
    setSaveMsg('Carrier mode activated — SLA timers started!');
    setTimeout(() => setSaveMsg(''), 4000);
  };

  // ── Handle item complete (also persists to Supabase if needed) ────────────
  const handleItemComplete = (itemId: string) => {
    markItemComplete(itemId);
  };

  // ── Handle file upload ────────────────────────────────────────────────────
  const handleFileUpload = async (category: string, file: File) => {
    if (!id) return;
    await uploadFile(id, category, file);
    setSaveMsg('File uploaded!');
    setTimeout(() => setSaveMsg(''), 3000);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (pageLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    </div>
  );

  if (pageError) return (
    <div className="p-6 flex items-center gap-2 text-red-600">
      <AlertCircle className="w-5 h-5" /> {pageError}
    </div>
  );

  return (
    <div className="p-4 max-w-3xl mx-auto pb-12">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-5">
        <Link href={`/jobs/${id}`} className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900 truncate">Carrier Mode</h1>
            {carrier && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: carrier.carrier_color }}>
                {carrier.insurer_name}
              </span>
            )}
          </div>
          {job && (
            <p className="text-sm text-gray-500 truncate mt-0.5">
              {job.insured_name} — {job.property_address}
              {job.claim_number && <span className="ml-2 font-mono">#{job.claim_number}</span>}
            </p>
          )}
        </div>
      </div>

      {/* ── Save message ───────────────────────────────────────────────────── */}
      {saveMsg && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg p-3 mb-4">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> {saveMsg}
        </div>
      )}

      {/* ── Carrier Error ──────────────────────────────────────────────────── */}
      {carrierError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-4">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {carrierError}
        </div>
      )}

      {/* ── Carrier Select (always shown) ──────────────────────────────────── */}
      <div className="bg-slate-800 rounded-xl p-4 mb-5 space-y-3">
        <p className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-400" />
          Select Insurance Carrier
        </p>
        <CarrierSelect
          onCarrierSelect={handleCarrierSelect}
          defaultValue={activeCarrierSlug ?? undefined}
        />
        {activeCarrierSlug && activeCarrierSlug !== job?.carrier_slug && (
          <button
            onClick={saveCarrierChoice}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-lg transition text-sm mt-2"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Activating…</> : <><Shield className="w-4 h-4" /> Activate Carrier Mode & Start SLA Timers</>}
          </button>
        )}
        {job?.carrier_slug && job.carrier_slug === activeCarrierSlug && (
          <div className="flex items-center gap-1.5 text-xs text-green-400 font-medium pt-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Carrier mode active — SLA timers running
          </div>
        )}
      </div>

      {/* ── Stats (only when carrier active) ──────────────────────────────── */}
      {carrier && job?.carrier_slug && (
        <div className="grid grid-cols-2 gap-3 mb-5">
          <StatCard icon={TrendingUp} label="Completion" value={`${completionPct}%`} color={carrier.carrier_color} />
          <StatCard icon={Clock} label="Overdue Timers" value={overdueTimers.length} color="#ef4444" pulse={overdueTimers.length > 0} />
          <StatCard icon={FileText} label="Files Uploaded" value={carrierFiles.filter((f: { upload_status: string }) => f.upload_status === 'uploaded').length} color="#10b981" />
          <StatCard icon={AlertTriangle} label="Blocking Items" value={blockedItems.length} color="#f59e0b" pulse={blockedItems.length > 0} />
        </div>
      )}

      {/* ── Checklist ─────────────────────────────────────────────────────── */}
      {carrier && job?.carrier_slug && (
        <>
          {carrierLoading ? (
            <div className="flex items-center justify-center h-32 text-gray-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading carrier checklist…
            </div>
          ) : checklist.length > 0 ? (
            <CarrierChecklist
              jobId={id}
              carrier={carrier}
              checklist={checklist}
              slaTimers={slaTimers}
              files={carrierFiles}
              onItemComplete={handleItemComplete}
              onFileUpload={handleFileUpload}
            />
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 text-center">
              <AlertTriangle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
              <p className="font-semibold text-yellow-800">No checklist templates found</p>
              <p className="text-sm text-yellow-700 mt-1">
                Run the DB migration <code className="bg-yellow-100 px-1 rounded">0008_carrier_mode.sql</code> in Supabase to populate carrier checklists.
              </p>
              <a
                href="https://supabase.com/dashboard/project/ilxojqefffravkjxyqlx/sql/new"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
              >
                Open Supabase SQL Editor →
              </a>
            </div>
          )}
        </>
      )}

      {/* ── Empty state (no carrier selected) ─────────────────────────────── */}
      {!activeCarrierSlug && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
          <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-700 text-lg">No Carrier Selected</p>
          <p className="text-sm text-gray-500 mt-1">
            Select the insurance carrier above to load the carrier-specific checklist,<br />
            SLA countdown timers, and required photo labels.
          </p>
        </div>
      )}
    </div>
  );
}
