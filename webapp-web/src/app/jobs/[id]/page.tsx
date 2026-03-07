'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import WorkflowProgressBar, { type WorkflowStep } from '@/components/WorkflowProgressBar';
import DeadlineCountdown from '@/components/DeadlineCountdown';
import {
  ArrowLeft, MapPin, Phone, Mail, User, Calendar, FileText, Hash,
  Building2, Loader2, AlertCircle, CheckCircle, ChevronRight,
  Clock, Send, MessageSquare, Upload, Eye, PenTool, Download,
  Zap, Radio, Globe, PhoneCall, Star, UserCheck, Navigation,
  FileCheck, X, Save, Edit3, ExternalLink, Shield, AlertTriangle
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Job {
  id: string;
  insured_name: string; insured_phone: string | null; insured_email: string | null;
  property_address: string; property_city: string | null; property_postal_code: string | null;
  claim_number: string | null; insurer_name: string | null;
  loss_date: string | null; loss_category: number | null; loss_class: number | null;
  job_type: string; status: string; current_step: number;
  adjuster_name: string | null; adjuster_email: string | null; adjuster_phone: string | null;
  notes: string | null; created_at: string; updated_at: string;
  // Step 1 - File Creation
  lead_source: string | null; lead_source_detail: string | null;
  created_by_name: string | null; created_by_phone: string | null; created_by_email: string | null;
  // Step 2 - Dispatch
  dispatched_to_name: string | null; dispatched_to_phone: string | null;
  dispatched_to_email: string | null; dispatched_at: string | null;
  dispatch_notes: string | null; eta_minutes: number | null;
  // Step 3 - Work Auth
  work_auth_status: string | null; work_auth_sent_at: string | null;
  work_auth_signed_at: string | null; work_auth_signed_by: string | null;
  work_auth_doc_url: string | null;
}

interface Document {
  id: string; job_id: string; doc_type: string; doc_url: string;
  file_name: string | null; signed_status: string; signed_at: string | null;
  signed_by: string | null; created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700', dispatched: 'bg-purple-100 text-purple-700',
  active: 'bg-green-100 text-green-700', review: 'bg-yellow-100 text-yellow-700',
  closed: 'bg-gray-100 text-gray-500', draft: 'bg-gray-100 text-gray-400',
};
const JOB_TYPE_ICON: Record<string, string> = {
  water_loss: '💧', fire_loss: '🔥', mold: '🌿', large_loss: '🏗️', other: '📋',
};
const LEAD_SOURCE_ICONS: Record<string, { icon: string; label: string; color: string }> = {
  manual:        { icon: '✏️', label: 'Manual Entry',      color: 'bg-gray-100 text-gray-700'   },
  phone:         { icon: '📞', label: 'Phone Call',         color: 'bg-blue-100 text-blue-700'   },
  ppc_ad:        { icon: '🎯', label: 'PPC Ad (Google/Meta)', color: 'bg-orange-100 text-orange-700' },
  xactanalysis:  { icon: '📊', label: 'Xactanalysis',       color: 'bg-purple-100 text-purple-700'},
  referral:      { icon: '🤝', label: 'Referral',           color: 'bg-green-100 text-green-700' },
  repeat_client: { icon: '⭐', label: 'Repeat Client',      color: 'bg-yellow-100 text-yellow-700'},
  other:         { icon: '📋', label: 'Other',              color: 'bg-gray-100 text-gray-600'   },
};
const WORK_AUTH_STATUS: Record<string, { label: string; color: string; icon: string }> = {
  pending:  { label: 'Not Sent',    color: 'bg-gray-100 text-gray-500',    icon: '⏳' },
  sent:     { label: 'Sent',        color: 'bg-blue-100 text-blue-700',    icon: '📤' },
  viewed:   { label: 'Viewed',      color: 'bg-yellow-100 text-yellow-700',icon: '👁️' },
  signed:   { label: 'Signed ✓',   color: 'bg-green-100 text-green-700',  icon: '✅' },
  declined: { label: 'Declined',    color: 'bg-red-100 text-red-700',      icon: '❌' },
};
const STEP_META = [
  { num: 1,  label: 'File Creation',       icon: FileText,    color: 'blue'   },
  { num: 2,  label: 'Dispatch',            icon: Navigation,  color: 'purple' },
  { num: 3,  label: 'Work Auth',           icon: Shield,      color: 'green'  },
  { num: 4,  label: 'Day-1 Evidence',      icon: Eye,         color: 'orange' },
  { num: 5,  label: 'Content Inventory',   icon: FileCheck,   color: 'teal'   },
  { num: 6,  label: 'Equipment',           icon: Zap,         color: 'yellow' },
  { num: 7,  label: '24-Hr Report',        icon: Clock,       color: 'red'    },
  { num: 8,  label: 'Floor Plan Scan',     icon: Globe,       color: 'blue'   },
  { num: 9,  label: 'Moisture Setup',      icon: Radio,       color: 'cyan'   },
  { num: 10, label: 'Drying Logs',         icon: FileText,    color: 'blue'   },
  { num: 11, label: 'Drying Goal Met',     icon: CheckCircle, color: 'green'  },
  { num: 12, label: 'Equip. Removal',      icon: Zap,         color: 'orange' },
  { num: 13, label: 'Final Scope',         icon: FileCheck,   color: 'purple' },
  { num: 14, label: 'Close Checklist',     icon: UserCheck,   color: 'teal'   },
  { num: 15, label: 'Invoice & Close',     icon: Star,        color: 'gold'   },
];

// ─── Helper: Contact Action Buttons ──────────────────────────────────────────
function ContactActions({ phone, email, name }: { phone?: string | null; email?: string | null; name?: string | null }) {
  return (
    <div className="flex gap-2 flex-wrap mt-2">
      {phone && (
        <>
          <a href={`tel:${phone}`}
            className="flex items-center gap-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium px-3 py-1.5 rounded-lg transition border border-blue-200">
            <PhoneCall className="w-3 h-3" /> Call
          </a>
          <a href={`sms:${phone}${name ? `?body=Hi ${name.split(' ')[0]}, this is regarding your restoration file.` : ''}`}
            className="flex items-center gap-1.5 text-xs bg-green-50 hover:bg-green-100 text-green-700 font-medium px-3 py-1.5 rounded-lg transition border border-green-200">
            <MessageSquare className="w-3 h-3" /> SMS
          </a>
        </>
      )}
      {email && (
        <a href={`mailto:${email}${name ? `?subject=Re: Restoration Job&body=Dear ${name.split(' ')[0]},` : ''}`}
          className="flex items-center gap-1.5 text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 font-medium px-3 py-1.5 rounded-lg transition border border-purple-200">
          <Mail className="w-3 h-3" /> Email
        </a>
      )}
    </div>
  );
}

// ─── Helper: Info Row ─────────────────────────────────────────────────────────
function InfoRow({ icon: Icon, label, value, mono = false }: { icon: React.ElementType; label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <Icon className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400 font-medium mb-0.5">{label}</p>
        <div className={`text-sm text-gray-800 font-medium ${mono ? 'font-mono' : ''}`}>{value}</div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [job, setJob] = useState<Job | null>(null);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [editingStep, setEditingStep] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [userId, setUserId] = useState('');

  // Editable fields for step panels
  const [step1Form, setStep1Form] = useState({
    lead_source: 'manual', lead_source_detail: '',
    created_by_name: '', created_by_phone: '', created_by_email: '',
  });
  const [step2Form, setStep2Form] = useState({
    dispatched_to_name: '', dispatched_to_phone: '', dispatched_to_email: '',
    dispatched_at: '', dispatch_notes: '', eta_minutes: '',
  });
  const [step3Form, setStep3Form] = useState({
    work_auth_status: 'pending', work_auth_signed_by: '',
  });

  useEffect(() => {
    const fetchJob = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setUserId(session.user.id);

      const [jobRes, stepsRes, docsRes] = await Promise.all([
        supabase.from('jobs').select('*').eq('id', id).eq('user_id', session.user.id).single(),
        supabase.from('workflow_steps').select('*').eq('job_id', id).order('step_number'),
        supabase.from('documents').select('*').eq('job_id', id).order('created_at', { ascending: false }),
      ]);

      if (jobRes.error || !jobRes.data) {
        setError('Job not found or access denied.');
      } else {
        const j = jobRes.data;
        setJob(j);
        setWorkflowSteps(stepsRes.data || []);
        setDocuments(docsRes.data || []);
        // Pre-fill forms
        setStep1Form({
          lead_source: j.lead_source || 'manual',
          lead_source_detail: j.lead_source_detail || '',
          created_by_name: j.created_by_name || '',
          created_by_phone: j.created_by_phone || '',
          created_by_email: j.created_by_email || '',
        });
        setStep2Form({
          dispatched_to_name: j.dispatched_to_name || '',
          dispatched_to_phone: j.dispatched_to_phone || '',
          dispatched_to_email: j.dispatched_to_email || '',
          dispatched_at: j.dispatched_at ? j.dispatched_at.slice(0, 16) : '',
          dispatch_notes: j.dispatch_notes || '',
          eta_minutes: j.eta_minutes?.toString() || '',
        });
        setStep3Form({
          work_auth_status: j.work_auth_status || 'pending',
          work_auth_signed_by: j.work_auth_signed_by || '',
        });
        // Auto-open the active step panel
        setActiveStep(j.current_step);
      }
      setLoading(false);
    };
    if (id) fetchJob();
  }, [id, router]);

  const updateStatus = async (newStatus: string) => {
    if (!job) return;
    setStatusUpdating(true);
    await supabase.from('jobs').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', job.id);
    setJob(prev => prev ? { ...prev, status: newStatus } : prev);
    setStatusUpdating(false);
  };

  const advanceWorkflowStep = async (stepNumber: number) => {
    if (!job) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('workflow_steps').update({
      status: 'complete', completed_at: new Date().toISOString(),
      completed_by: session.user.id, updated_at: new Date().toISOString(),
    }).eq('job_id', job.id).eq('step_number', stepNumber);
    if (stepNumber < 15) {
      await supabase.from('workflow_steps').update({ status: 'in_progress', updated_at: new Date().toISOString() })
        .eq('job_id', job.id).eq('step_number', stepNumber + 1);
      await supabase.from('jobs').update({ current_step: stepNumber + 1, updated_at: new Date().toISOString() }).eq('id', job.id);
      setJob(prev => prev ? { ...prev, current_step: stepNumber + 1 } : prev);
      setActiveStep(stepNumber + 1);
    }
    const { data: updatedSteps } = await supabase.from('workflow_steps').select('*').eq('job_id', job.id).order('step_number');
    setWorkflowSteps(updatedSteps || []);
  };

  const saveStep1 = async () => {
    if (!job) return;
    setSaving(true);
    await supabase.from('jobs').update({
      lead_source: step1Form.lead_source,
      lead_source_detail: step1Form.lead_source_detail || null,
      created_by_name: step1Form.created_by_name || null,
      created_by_phone: step1Form.created_by_phone || null,
      created_by_email: step1Form.created_by_email || null,
      updated_at: new Date().toISOString(),
    }).eq('id', job.id);
    setJob(prev => prev ? { ...prev, ...step1Form } : prev);
    setSaving(false); setSaveSuccess('Step 1 saved!'); setEditingStep(null);
    setTimeout(() => setSaveSuccess(''), 3000);
  };

  const saveStep2 = async () => {
    if (!job) return;
    setSaving(true);
    const payload: Record<string, unknown> = {
      dispatched_to_name: step2Form.dispatched_to_name || null,
      dispatched_to_phone: step2Form.dispatched_to_phone || null,
      dispatched_to_email: step2Form.dispatched_to_email || null,
      dispatched_at: step2Form.dispatched_at ? new Date(step2Form.dispatched_at).toISOString() : null,
      dispatch_notes: step2Form.dispatch_notes || null,
      eta_minutes: step2Form.eta_minutes ? parseInt(step2Form.eta_minutes) : null,
      updated_at: new Date().toISOString(),
    };
    // Auto-set status to dispatched if tech is assigned
    if (step2Form.dispatched_to_name && job.status === 'new') {
      payload.status = 'dispatched';
      setJob(prev => prev ? { ...prev, status: 'dispatched' } : prev);
    }
    await supabase.from('jobs').update(payload).eq('id', job.id);
    setJob(prev => prev ? { ...prev,
      dispatched_to_name: step2Form.dispatched_to_name || null,
      dispatched_to_phone: step2Form.dispatched_to_phone || null,
      dispatched_to_email: step2Form.dispatched_to_email || null,
      dispatched_at: step2Form.dispatched_at ? new Date(step2Form.dispatched_at).toISOString() : null,
      dispatch_notes: step2Form.dispatch_notes || null,
      eta_minutes: step2Form.eta_minutes ? parseInt(step2Form.eta_minutes) : null,
    } : prev);
    setSaving(false); setSaveSuccess('Dispatch saved!'); setEditingStep(null);
    setTimeout(() => setSaveSuccess(''), 3000);
  };

  const saveStep3 = async () => {
    if (!job) return;
    setSaving(true);
    const now = new Date().toISOString();
    const payload: Record<string, unknown> = {
      work_auth_status: step3Form.work_auth_status,
      updated_at: now,
    };
    if (step3Form.work_auth_status === 'sent' && !job.work_auth_sent_at) payload.work_auth_sent_at = now;
    if (step3Form.work_auth_status === 'signed') {
      payload.work_auth_signed_at = now;
      payload.work_auth_signed_by = step3Form.work_auth_signed_by || null;
    }
    await supabase.from('jobs').update(payload).eq('id', job.id);
    setJob(prev => prev ? { ...prev,
      work_auth_status: step3Form.work_auth_status,
      work_auth_signed_by: step3Form.work_auth_signed_by || null,
      work_auth_sent_at: step3Form.work_auth_status === 'sent' && !prev.work_auth_sent_at ? now : prev.work_auth_sent_at,
      work_auth_signed_at: step3Form.work_auth_status === 'signed' ? now : prev.work_auth_signed_at,
    } : prev);
    setSaving(false); setSaveSuccess('Work Auth saved!'); setEditingStep(null);
    setTimeout(() => setSaveSuccess(''), 3000);
  };

  const uploadWorkAuthDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !job) return;
    setUploadingDoc(true);
    const ext = file.name.split('.').pop();
    const path = `${userId}/${job.id}/work_auth_${Date.now()}.${ext}`;
    const { error: storageErr } = await supabase.storage.from('documents').upload(path, file, { contentType: file.type });
    if (storageErr) { setError(storageErr.message); setUploadingDoc(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path);
    await supabase.from('jobs').update({ work_auth_doc_url: publicUrl, updated_at: new Date().toISOString() }).eq('id', job.id);
    await supabase.from('documents').insert({
      job_id: job.id, doc_type: 'waf', doc_url: publicUrl,
      file_name: file.name, signed_status: 'unsigned',
    });
    const { data: docs } = await supabase.from('documents').select('*').eq('job_id', job.id).order('created_at', { ascending: false });
    setDocuments(docs || []);
    setJob(prev => prev ? { ...prev, work_auth_doc_url: publicUrl } : prev);
    setUploadingDoc(false); setSaveSuccess('Document uploaded!');
    setTimeout(() => setSaveSuccess(''), 3000);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getStepStatus = (num: number) => workflowSteps.find(s => s.step_number === num)?.status || 'pending';

  // ─── Render ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  );
  if (error || !job) return (
    <div className="p-6 max-w-2xl mx-auto text-center">
      <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
      <p className="text-gray-600">{error || 'Job not found.'}</p>
      <Link href="/jobs" className="text-blue-600 hover:underline text-sm mt-2 inline-block">← Back to Jobs</Link>
    </div>
  );

  const ls = LEAD_SOURCE_ICONS[job.lead_source || 'manual'] || LEAD_SOURCE_ICONS.manual;
  const wa = WORK_AUTH_STATUS[job.work_auth_status || 'pending'] || WORK_AUTH_STATUS.pending;
  const wafDocs = documents.filter(d => d.doc_type === 'waf');

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-4">
      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <Link href="/jobs" className="p-2 hover:bg-gray-100 rounded-lg transition mt-1">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">
              {JOB_TYPE_ICON[job.job_type]} {job.insured_name}
            </h1>
            <span className={`text-sm font-medium px-3 py-1 rounded-full capitalize ${STATUS_BADGE[job.status] || 'bg-gray-100 text-gray-600'}`}>
              {job.status}
            </span>
          </div>
          <div className="flex items-center gap-1 text-gray-500 text-sm mt-1">
            <MapPin className="w-3.5 h-3.5" />
            {job.property_address}{job.property_city ? `, ${job.property_city}` : ''}{job.property_postal_code ? ` ${job.property_postal_code}` : ''}
          </div>
        </div>
        <select value={job.status} onChange={e => updateStatus(e.target.value)} disabled={statusUpdating}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none">
          <option value="new">New</option>
          <option value="dispatched">Dispatched</option>
          <option value="active">Active</option>
          <option value="review">In Review</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* Save success */}
      {saveSuccess && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg p-3">
          <CheckCircle className="w-4 h-4 shrink-0" />{saveSuccess}
        </div>
      )}

      {/* ── Deadline Countdowns ── */}
      <DeadlineCountdown createdAt={job.created_at} />

      {/* ── Workflow Progress Bar ── */}
      <WorkflowProgressBar steps={workflowSteps} currentStep={job.current_step} />

      {/* ── Clickable Step Tabs ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Tab row */}
        <div className="flex overflow-x-auto border-b border-gray-100 bg-gray-50 scrollbar-hide">
          {STEP_META.map(step => {
            const status = getStepStatus(step.num);
            const isActive = activeStep === step.num;
            const isComplete = status === 'complete' || status === 'overridden';
            const isInProgress = status === 'in_progress';
            return (
              <button
                key={step.num}
                onClick={() => setActiveStep(isActive ? null : step.num)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition whitespace-nowrap ${
                  isActive
                    ? 'border-blue-600 text-blue-700 bg-white'
                    : isComplete
                    ? 'border-green-400 text-green-700 hover:bg-white'
                    : isInProgress
                    ? 'border-blue-400 text-blue-600 hover:bg-white'
                    : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-white'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                  isComplete ? 'bg-green-500 text-white' :
                  isInProgress ? 'bg-blue-500 text-white' :
                  'bg-gray-200 text-gray-500'
                }`}>
                  {isComplete ? '✓' : step.num}
                </span>
                {step.label}
                {isInProgress && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
              </button>
            );
          })}
        </div>

        {/* ── Step Panel Content ── */}
        {activeStep !== null && (
          <div className="p-5">

            {/* ══════════ STEP 1: FILE CREATION ══════════ */}
            {activeStep === 1 && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-500" /> Step 1 — File Creation
                    <span className="text-xs text-gray-400 font-normal">
                      Created {new Date(job.created_at).toLocaleString()}
                    </span>
                  </h3>
                  <button onClick={() => setEditingStep(editingStep === 1 ? null : 1)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded-lg hover:bg-blue-50 transition">
                    <Edit3 className="w-3.5 h-3.5" /> {editingStep === 1 ? 'Cancel' : 'Edit'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Lead Source card */}
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Lead Source</p>
                    {editingStep === 1 ? (
                      <div className="space-y-3">
                        <select value={step1Form.lead_source} onChange={e => setStep1Form(p => ({ ...p, lead_source: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                          {Object.entries(LEAD_SOURCE_ICONS).map(([val, meta]) => (
                            <option key={val} value={val}>{meta.icon} {meta.label}</option>
                          ))}
                        </select>
                        <input type="text" value={step1Form.lead_source_detail}
                          onChange={e => setStep1Form(p => ({ ...p, lead_source_detail: e.target.value }))}
                          placeholder="Detail (e.g. Google Ad – Water Damage Ottawa)"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                    ) : (
                      <div>
                        <span className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg ${ls.color}`}>
                          {ls.icon} {ls.label}
                        </span>
                        {job.lead_source_detail && (
                          <p className="text-xs text-gray-500 mt-2">{job.lead_source_detail}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* File Created By */}
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">File Created By</p>
                    {editingStep === 1 ? (
                      <div className="space-y-2">
                        <input type="text" value={step1Form.created_by_name}
                          onChange={e => setStep1Form(p => ({ ...p, created_by_name: e.target.value }))}
                          placeholder="Staff name"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                        <input type="tel" value={step1Form.created_by_phone}
                          onChange={e => setStep1Form(p => ({ ...p, created_by_phone: e.target.value }))}
                          placeholder="Cell number"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                        <input type="email" value={step1Form.created_by_email}
                          onChange={e => setStep1Form(p => ({ ...p, created_by_email: e.target.value }))}
                          placeholder="Email"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                    ) : job.created_by_name ? (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <User className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{job.created_by_name}</p>
                            {job.created_by_phone && <p className="text-xs text-gray-500">{job.created_by_phone}</p>}
                          </div>
                        </div>
                        <ContactActions phone={job.created_by_phone} email={job.created_by_email} name={job.created_by_name} />
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 italic">Not recorded — click Edit to add staff info</p>
                    )}
                  </div>
                </div>

                {/* Insured summary */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Insured / Client</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <InfoRow icon={User} label="Insured Name" value={job.insured_name} />
                    <InfoRow icon={Hash} label="Claim #" value={job.claim_number || <span className="text-gray-300">—</span>} mono />
                    <InfoRow icon={Calendar} label="Loss Date" value={job.loss_date ? new Date(job.loss_date).toLocaleDateString() : <span className="text-gray-300">—</span>} />
                  </div>
                  <ContactActions phone={job.insured_phone} email={job.insured_email} name={job.insured_name} />
                </div>

                {editingStep === 1 && (
                  <button onClick={saveStep1} disabled={saving}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save File Creation Data
                  </button>
                )}

                {/* Advance button */}
                {getStepStatus(1) !== 'complete' && (
                  <div className="pt-2 border-t border-gray-100">
                    <button onClick={() => advanceWorkflowStep(1)}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
                      <CheckCircle className="w-4 h-4" /> Mark Step 1 Complete → Move to Dispatch
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ══════════ STEP 2: DISPATCH ══════════ */}
            {activeStep === 2 && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-purple-500" /> Step 2 — Dispatch
                    {job.dispatched_at && (
                      <span className="text-xs text-gray-400 font-normal">
                        Dispatched {new Date(job.dispatched_at).toLocaleString()}
                      </span>
                    )}
                  </h3>
                  <button onClick={() => setEditingStep(editingStep === 2 ? null : 2)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded-lg hover:bg-blue-50 transition">
                    <Edit3 className="w-3.5 h-3.5" /> {editingStep === 2 ? 'Cancel' : 'Edit'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Technician dispatched to */}
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                      Technician / Team Assigned
                    </p>
                    {editingStep === 2 ? (
                      <div className="space-y-2">
                        <input type="text" value={step2Form.dispatched_to_name}
                          onChange={e => setStep2Form(p => ({ ...p, dispatched_to_name: e.target.value }))}
                          placeholder="Tech name"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                        <input type="tel" value={step2Form.dispatched_to_phone}
                          onChange={e => setStep2Form(p => ({ ...p, dispatched_to_phone: e.target.value }))}
                          placeholder="Cell number"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                        <input type="email" value={step2Form.dispatched_to_email}
                          onChange={e => setStep2Form(p => ({ ...p, dispatched_to_email: e.target.value }))}
                          placeholder="Email"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                    ) : job.dispatched_to_name ? (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center">
                            <UserCheck className="w-4 h-4 text-purple-600" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{job.dispatched_to_name}</p>
                            {job.dispatched_to_phone && <p className="text-xs text-gray-500">{job.dispatched_to_phone}</p>}
                            {job.dispatched_to_email && <p className="text-xs text-gray-400">{job.dispatched_to_email}</p>}
                          </div>
                        </div>
                        <ContactActions phone={job.dispatched_to_phone} email={job.dispatched_to_email} name={job.dispatched_to_name} />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-gray-400 italic">
                        <AlertTriangle className="w-4 h-4 text-yellow-400" />
                        Not dispatched yet — click Edit to assign a technician
                      </div>
                    )}
                  </div>

                  {/* Dispatch timing */}
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Dispatch Timing</p>
                    {editingStep === 2 ? (
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Dispatch Date & Time</label>
                          <input type="datetime-local" value={step2Form.dispatched_at}
                            onChange={e => setStep2Form(p => ({ ...p, dispatched_at: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">ETA (minutes)</label>
                          <input type="number" min="0" value={step2Form.eta_minutes}
                            onChange={e => setStep2Form(p => ({ ...p, eta_minutes: e.target.value }))}
                            placeholder="e.g. 45"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <InfoRow icon={Clock}
                          label="Dispatched At"
                          value={job.dispatched_at ? new Date(job.dispatched_at).toLocaleString() : <span className="text-gray-300">Not set</span>} />
                        <InfoRow icon={Navigation}
                          label="ETA"
                          value={job.eta_minutes ? `${job.eta_minutes} minutes` : <span className="text-gray-300">Not set</span>} />
                        <InfoRow icon={Clock}
                          label="File Created"
                          value={new Date(job.created_at).toLocaleString()} />
                        {job.dispatched_at && (
                          <div className="mt-2 bg-purple-50 rounded-lg p-2 text-xs text-purple-700 font-medium">
                            ⏱️ Response time: {Math.round((new Date(job.dispatched_at).getTime() - new Date(job.created_at).getTime()) / 60000)} min from file creation
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Dispatch notes */}
                {(editingStep === 2 || job.dispatch_notes) && (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Dispatch Notes</p>
                    {editingStep === 2 ? (
                      <textarea value={step2Form.dispatch_notes}
                        onChange={e => setStep2Form(p => ({ ...p, dispatch_notes: e.target.value }))}
                        rows={3} placeholder="Special instructions, access code, lockbox, etc."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
                    ) : (
                      <p className="text-sm text-gray-700 leading-relaxed">{job.dispatch_notes}</p>
                    )}
                  </div>
                )}

                {/* Property for navigation */}
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                  <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">Property Address</p>
                  <p className="text-sm font-medium text-gray-800">
                    {job.property_address}{job.property_city ? `, ${job.property_city}` : ''}{job.property_postal_code ? ` ${job.property_postal_code}` : ''}
                  </p>
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent([job.property_address, job.property_city].filter(Boolean).join(', '))}`}
                    target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 mt-2 text-xs bg-white hover:bg-blue-100 text-blue-700 font-medium px-3 py-1.5 rounded-lg border border-blue-200 transition">
                    <MapPin className="w-3 h-3" /> Open in Google Maps
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {editingStep === 2 && (
                  <button onClick={saveStep2} disabled={saving}
                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Dispatch Data
                  </button>
                )}

                {getStepStatus(2) !== 'complete' && (
                  <div className="pt-2 border-t border-gray-100">
                    <button onClick={() => advanceWorkflowStep(2)}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
                      <CheckCircle className="w-4 h-4" /> Mark Dispatched → Move to Work Authorization
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ══════════ STEP 3: WORK AUTHORIZATION ══════════ */}
            {activeStep === 3 && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-green-500" /> Step 3 — Work Authorization
                  </h3>
                  <button onClick={() => setEditingStep(editingStep === 3 ? null : 3)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded-lg hover:bg-blue-50 transition">
                    <Edit3 className="w-3.5 h-3.5" /> {editingStep === 3 ? 'Cancel' : 'Edit Status'}
                  </button>
                </div>

                {/* Status banner */}
                <div className={`rounded-xl p-4 border-2 flex items-center gap-3 ${
                  job.work_auth_status === 'signed' ? 'bg-green-50 border-green-300' :
                  job.work_auth_status === 'declined' ? 'bg-red-50 border-red-300' :
                  job.work_auth_status === 'sent' || job.work_auth_status === 'viewed' ? 'bg-blue-50 border-blue-300' :
                  'bg-gray-50 border-gray-200'
                }`}>
                  <div className="text-3xl">{wa.icon}</div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">Authorization Status: <span className={`px-2 py-0.5 rounded-full text-sm ${wa.color}`}>{wa.label}</span></p>
                    {job.work_auth_sent_at && <p className="text-xs text-gray-500 mt-0.5">Sent: {new Date(job.work_auth_sent_at).toLocaleString()}</p>}
                    {job.work_auth_signed_at && <p className="text-xs text-green-600 mt-0.5">Signed: {new Date(job.work_auth_signed_at).toLocaleString()} {job.work_auth_signed_by ? `by ${job.work_auth_signed_by}` : ''}</p>}
                  </div>
                </div>

                {editingStep === 3 && (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Update Authorization Status</label>
                      <select value={step3Form.work_auth_status}
                        onChange={e => setStep3Form(p => ({ ...p, work_auth_status: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                        {Object.entries(WORK_AUTH_STATUS).map(([val, meta]) => (
                          <option key={val} value={val}>{meta.icon} {meta.label}</option>
                        ))}
                      </select>
                    </div>
                    {step3Form.work_auth_status === 'signed' && (
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Signed By (name)</label>
                        <input type="text" value={step3Form.work_auth_signed_by}
                          onChange={e => setStep3Form(p => ({ ...p, work_auth_signed_by: e.target.value }))}
                          placeholder="e.g. John Peters"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                    )}
                    <button onClick={saveStep3} disabled={saving}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Authorization Status
                    </button>
                  </div>
                )}

                {/* Document upload */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Work Authorization Form (WAF)</p>
                    <button onClick={() => fileInputRef.current?.click()} disabled={uploadingDoc}
                      className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium px-3 py-1.5 rounded-lg transition">
                      {uploadingDoc ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      {uploadingDoc ? 'Uploading…' : 'Upload WAF'}
                    </button>
                    <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,image/*" className="hidden" onChange={uploadWorkAuthDoc} />
                  </div>

                  {wafDocs.length === 0 ? (
                    <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-lg">
                      <PenTool className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">No WAF document uploaded yet</p>
                      <p className="text-xs text-gray-300 mt-1">Upload a signed PDF, photo of signed form, or DocuSign document</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {wafDocs.map(doc => (
                        <div key={doc.id} className="flex items-center gap-3 bg-white rounded-lg p-3 border border-gray-200">
                          <FileText className="w-5 h-5 text-blue-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{doc.file_name || 'Work Authorization Form'}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                doc.signed_status === 'signed' ? 'bg-green-100 text-green-700' :
                                doc.signed_status === 'declined' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-500'
                              }`}>{doc.signed_status.toUpperCase()}</span>
                              <span className="text-xs text-gray-400">{new Date(doc.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <a href={doc.doc_url} target="_blank" rel="noreferrer"
                              className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-500 hover:text-blue-600">
                              <Eye className="w-4 h-4" />
                            </a>
                            <a href={doc.doc_url} download
                              className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-500 hover:text-green-600">
                              <Download className="w-4 h-4" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* E-sign actions */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-4 text-white">
                  <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-3">Send for E-Signature</p>
                  <p className="text-sm text-slate-300 mb-3">Send the Work Authorization Form to the insured for digital signing.</p>
                  <div className="flex gap-2 flex-wrap">
                    {job.insured_email && (
                      <a href={`mailto:${job.insured_email}?subject=Work Authorization – ${job.insured_name} Restoration&body=Dear ${job.insured_name.split(' ')[0]},\n\nPlease review and sign the attached Work Authorization Form for your restoration project.\n\nProperty: ${job.property_address}\nClaim #: ${job.claim_number || 'N/A'}\n\nThank you.`}
                        className="flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 text-white font-medium px-3 py-1.5 rounded-lg border border-white/20 transition">
                        <Send className="w-3 h-3" /> Email WAF to Insured
                      </a>
                    )}
                    {job.insured_phone && (
                      <a href={`sms:${job.insured_phone}?body=Hi ${job.insured_name.split(' ')[0]}, please sign your Work Authorization Form for your restoration job. Reply CONFIRM to authorize work to begin.`}
                        className="flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 text-white font-medium px-3 py-1.5 rounded-lg border border-white/20 transition">
                        <MessageSquare className="w-3 h-3" /> SMS to Insured
                      </a>
                    )}
                    <button className="flex items-center gap-1.5 text-xs bg-blue-500/30 hover:bg-blue-500/50 text-blue-200 font-medium px-3 py-1.5 rounded-lg border border-blue-400/30 transition">
                      <PenTool className="w-3 h-3" /> DocuSign (coming soon)
                    </button>
                  </div>
                </div>

                {getStepStatus(3) !== 'complete' && (
                  <div className="pt-2 border-t border-gray-100">
                    <button
                      onClick={() => advanceWorkflowStep(3)}
                      disabled={job.work_auth_status !== 'signed'}
                      title={job.work_auth_status !== 'signed' ? 'Set status to Signed first' : ''}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
                      <CheckCircle className="w-4 h-4" />
                      {job.work_auth_status === 'signed' ? 'Mark Work Auth Complete → Day-1 Evidence' : '⚠️ WAF must be Signed to advance'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ══════════ STEPS 4-15: Coming panels ══════════ */}
            {activeStep !== null && activeStep > 3 && (
              <div className="py-8 text-center">
                <div className="text-4xl mb-3">{STEP_META[activeStep - 1]?.label.split(' ')[0] === 'Invoice' ? '💰' : '🔧'}</div>
                <p className="font-semibold text-gray-700 mb-1">Step {activeStep}: {STEP_META[activeStep - 1]?.label}</p>
                <p className="text-sm text-gray-400 mb-4">
                  {getStepStatus(activeStep) === 'complete' ? '✅ This step has been completed.' :
                   getStepStatus(activeStep) === 'in_progress' ? '🔵 This step is currently in progress.' :
                   '⏳ This step is pending.'}
                </p>
                {getStepStatus(activeStep) !== 'complete' && getStepStatus(activeStep) === 'in_progress' && (
                  <button onClick={() => advanceWorkflowStep(activeStep)}
                    className="flex items-center gap-2 mx-auto bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition">
                    <CheckCircle className="w-4 h-4" />
                    Mark Step {activeStep} Complete
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Details Grid (always visible below) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <User className="w-4 h-4 text-blue-500" /> Insured
          </h3>
          <div className="space-y-1">
            <InfoRow icon={User} label="Name" value={job.insured_name} />
            {job.insured_phone && <InfoRow icon={Phone} label="Phone" value={
              <a href={`tel:${job.insured_phone}`} className="text-blue-600 hover:underline">{job.insured_phone}</a>
            } />}
            {job.insured_email && <InfoRow icon={Mail} label="Email" value={
              <a href={`mailto:${job.insured_email}`} className="text-blue-600 hover:underline">{job.insured_email}</a>
            } />}
          </div>
          <ContactActions phone={job.insured_phone} email={job.insured_email} name={job.insured_name} />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-green-500" /> Claim
          </h3>
          <div className="space-y-1">
            <InfoRow icon={Hash} label="Claim #" value={job.claim_number || '—'} mono />
            <InfoRow icon={Building2} label="Insurer" value={job.insurer_name || '—'} />
            <InfoRow icon={Calendar} label="Loss Date" value={job.loss_date ? new Date(job.loss_date).toLocaleDateString() : '—'} />
            {job.loss_category && <InfoRow icon={AlertTriangle} label="Category / Class" value={`Cat ${job.loss_category} / Class ${job.loss_class}`} />}
          </div>
        </div>

        {(job.adjuster_name || job.adjuster_email || job.adjuster_phone) && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-orange-500" /> Adjuster
            </h3>
            <div className="space-y-1">
              {job.adjuster_name && <InfoRow icon={User} label="Name" value={job.adjuster_name} />}
              {job.adjuster_phone && <InfoRow icon={Phone} label="Phone" value={
                <a href={`tel:${job.adjuster_phone}`} className="text-blue-600 hover:underline">{job.adjuster_phone}</a>
              } />}
              {job.adjuster_email && <InfoRow icon={Mail} label="Email" value={
                <a href={`mailto:${job.adjuster_email}`} className="text-blue-600 hover:underline">{job.adjuster_email}</a>
              } />}
            </div>
            <ContactActions phone={job.adjuster_phone} email={job.adjuster_email} name={job.adjuster_name} />
          </div>
        )}

        {job.notes && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Notes</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{job.notes}</p>
          </div>
        )}
      </div>

      <div className="text-xs text-gray-400 flex gap-4 pb-4">
        <span>Created: {new Date(job.created_at).toLocaleString()}</span>
        <span>Updated: {new Date(job.updated_at).toLocaleString()}</span>
      </div>
    </div>
  );
}
