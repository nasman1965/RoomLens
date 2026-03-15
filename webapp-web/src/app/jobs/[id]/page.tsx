'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import WorkflowProgressBar, { type WorkflowStep } from '@/components/WorkflowProgressBar';
import DeadlineCountdown from '@/components/DeadlineCountdown';
import JobPhotosTab from '@/components/job-tabs/JobPhotosTab';
import JobMoistureTab from '@/components/job-tabs/JobMoistureTab';
import JobFloorPlanTab from '@/components/job-tabs/JobFloorPlanTab';
import JobShareTab from '@/components/job-tabs/JobShareTab';
import JobDocumentsTab from '@/components/job-tabs/JobDocumentsTab';
import JobXactimateTab from '@/components/job-tabs/JobXactimateTab';
import JobThermalTab from '@/components/job-tabs/JobThermalTab';
import {
  ArrowLeft, MapPin, Phone, Mail, User, Calendar, FileText, Hash,
  Building2, Loader2, AlertCircle, CheckCircle, ChevronRight,
  Clock, Send, MessageSquare, Upload, Eye, PenTool, Download,
  Zap, Radio, Globe, PhoneCall, Star, UserCheck, Navigation,
  FileCheck, X, Save, Edit3, ExternalLink, Shield, AlertTriangle,
  StopCircle, Users, ChevronDown, Sparkles, RefreshCw, NotebookPen,
  Camera, Droplets, Map, Share2, FilePen, Calculator, Thermometer,
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
  carrier_slug: string | null;
  // Step 1 - File Creation
  lead_source: string | null; lead_source_detail: string | null;
  created_by_name: string | null; created_by_phone: string | null; created_by_email: string | null;
  created_by_member_id: string | null;
  // Step 2 - Dispatch
  dispatched_to_name: string | null; dispatched_to_phone: string | null;
  dispatched_to_email: string | null; dispatched_at: string | null;
  dispatch_notes: string | null; eta_minutes: number | null;
  dispatched_member_id: string | null;
  // Step 3 - Work Auth
  work_auth_status: string | null; work_auth_sent_at: string | null;
  work_auth_signed_at: string | null; work_auth_signed_by: string | null;
  work_auth_doc_url: string | null;
  // Stop Job
  stopped: boolean; stop_reason: string | null; stop_notes: string | null;
  stopped_at: string | null; stopped_by: string | null;
  override_active: boolean; override_reason: string | null; override_by: string | null; override_at: string | null;
}

interface Document {
  id: string; job_id: string; doc_type: string; doc_url: string;
  file_name: string | null; signed_status: string; signed_at: string | null;
  signed_by: string | null; created_at: string;
}

interface TeamMember {
  id: string; full_name: string; role: string;
  cell_phone: string | null; email: string | null; is_active: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, string> = {
  new: 'bg-blue-100 text-cyan-300', dispatched: 'bg-purple-100 text-purple-700',
  active: 'bg-green-100 text-green-700', review: 'bg-yellow-100 text-yellow-700',
  closed: 'bg-slate-700/50 text-slate-500', draft: 'bg-slate-700/50 text-slate-600',
  stopped: 'bg-red-100 text-red-700',
};
const JOB_TYPE_ICON: Record<string, string> = {
  water_loss: '💧', fire_loss: '🔥', mold: '🌿', large_loss: '🏗️', other: '📋',
};
const LEAD_SOURCE_ICONS: Record<string, { icon: string; label: string; color: string }> = {
  manual:        { icon: '✏️', label: 'Manual Entry',      color: 'bg-slate-700/50 text-slate-300'   },
  phone:         { icon: '📞', label: 'Phone Call',         color: 'bg-blue-100 text-cyan-300'   },
  ppc_ad:        { icon: '🎯', label: 'PPC Ad (Google/Meta)', color: 'bg-orange-100 text-orange-700' },
  xactanalysis:  { icon: '📊', label: 'Xactanalysis',       color: 'bg-purple-100 text-purple-700'},
  referral:      { icon: '🤝', label: 'Referral',           color: 'bg-green-100 text-green-700' },
  repeat_client: { icon: '⭐', label: 'Repeat Client',      color: 'bg-yellow-100 text-yellow-700'},
  other:         { icon: '📋', label: 'Other',              color: 'bg-slate-700/50 text-slate-400'   },
};
const WORK_AUTH_STATUS: Record<string, { label: string; color: string; icon: string }> = {
  pending:  { label: 'Not Sent',    color: 'bg-slate-700/50 text-slate-500',    icon: '⏳' },
  sent:     { label: 'Sent',        color: 'bg-blue-100 text-cyan-300',    icon: '📤' },
  viewed:   { label: 'Viewed',      color: 'bg-yellow-100 text-yellow-700',icon: '👁️' },
  signed:   { label: 'Signed ✓',   color: 'bg-green-100 text-green-700',  icon: '✅' },
  declined: { label: 'Declined',    color: 'bg-red-100 text-red-700',      icon: '❌' },
};
const STOP_REASONS: { value: string; label: string; icon: string; description: string }[] = [
  { value: 'estimate_only',     label: 'Estimate Only',        icon: '📝', description: 'Client only wants a damage estimate, no restoration work authorized yet' },
  { value: 'client_cancelled',  label: 'Client Cancelled',     icon: '🚫', description: 'Client called back and does not wish to proceed with restoration' },
  { value: 'insurance_denied',  label: 'Insurance Denied',     icon: '🏛️', description: 'Insurance claim has been denied or coverage is insufficient' },
  { value: 'no_damage_found',   label: 'No Damage Found',      icon: '🔍', description: 'Tech arrived on site and found no significant damage warranting restoration' },
  { value: 'duplicate_file',    label: 'Duplicate File',       icon: '📋', description: 'This job was entered twice — duplicate of an existing active file' },
  { value: 'other',             label: 'Other Reason',         icon: '💬', description: 'Custom reason — please describe in the notes field' },
];
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

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', office: 'Office', estimator: 'Estimator',
  lead_tech: 'Lead Tech', tech: 'Technician', subcontractor: 'Subcontractor', other: 'Other',
};

// ─── Helper: Contact Action Buttons ──────────────────────────────────────────
function ContactActions({ phone, email, name }: { phone?: string | null; email?: string | null; name?: string | null }) {
  return (
    <div className="flex gap-2 flex-wrap mt-2">
      {phone && (
        <>
          <a href={`tel:${phone}`}
            className="flex items-center gap-1.5 text-xs bg-cyan-500/10 hover:bg-blue-100 text-cyan-300 font-medium px-3 py-1.5 rounded-lg transition border border-blue-200">
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
      <Icon className="w-4 h-4 text-slate-600 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-600 font-medium mb-0.5">{label}</p>
        <div className={`text-sm text-slate-200 font-medium ${mono ? 'font-mono' : ''}`}>{value}</div>
      </div>
    </div>
  );
}

// ─── Helper: Employee Dropdown ────────────────────────────────────────────────
function EmployeeSelect({
  members,
  selectedId,
  onSelect,
  placeholder = 'Select team member…',
}: {
  members: TeamMember[];
  selectedId: string;
  onSelect: (id: string, member: TeamMember | null) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <Users className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 pointer-events-none" />
      <select
        value={selectedId}
        onChange={e => {
          const id = e.target.value;
          const m = members.find(x => x.id === id) || null;
          onSelect(id, m);
        }}
        className="w-full pl-8 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white"
      >
        <option value="">{placeholder}</option>
        {members.filter(m => m.is_active).map(m => (
          <option key={m.id} value={m.id}>
            {m.full_name} — {ROLE_LABELS[m.role] || m.role}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 pointer-events-none" />
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
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // AI Notes state
  const [fieldNotes, setFieldNotes]         = useState('');
  const [aiNotes, setAiNotes]               = useState('');
  const [generatingNotes, setGeneratingNotes] = useState(false);
  const [savingNotes, setSavingNotes]       = useState(false);
  const [notesError, setNotesError]         = useState('');
  const [notesSaved, setNotesSaved]         = useState(false);

  // Job Hub top-tab
  const [activeJobTab, setActiveJobTab] = useState<'overview' | 'photos' | 'moisture' | 'floorplans' | 'share' | 'documents' | 'xactimate' | 'thermal'>('overview');

  // Stop Job modal state
  const [showStopModal, setShowStopModal] = useState(false);
  const [stopForm, setStopForm] = useState({ stop_reason: '', stop_notes: '' });
  const [stoppingJob, setStoppingJob] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [overriding, setOverriding] = useState(false);

  // Editable fields for step panels
  const [step1Form, setStep1Form] = useState({
    lead_source: 'manual', lead_source_detail: '',
    created_by_name: '', created_by_phone: '', created_by_email: '',
    created_by_member_id: '',
  });
  const [step2Form, setStep2Form] = useState({
    dispatched_to_name: '', dispatched_to_phone: '', dispatched_to_email: '',
    dispatched_at: '', dispatch_notes: '', eta_minutes: '',
    dispatched_member_id: '',
  });
  const [step3Form, setStep3Form] = useState({
    work_auth_status: 'pending', work_auth_signed_by: '',
  });

  useEffect(() => {
    const fetchJob = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setUserId(session.user.id);

      const [jobRes, stepsRes, docsRes, teamRes] = await Promise.all([
        supabase.from('jobs').select('*, carrier_slug').eq('id', id).eq('user_id', session.user.id).single(),
        supabase.from('workflow_steps').select('*').eq('job_id', id).order('step_number'),
        supabase.from('documents').select('*').eq('job_id', id).order('created_at', { ascending: false }),
        supabase.from('team_members').select('*').eq('user_id', session.user.id)
          .eq('is_active', true).order('full_name'),
      ]);

      if (jobRes.error || !jobRes.data) {
        setError('Job not found or access denied.');
      } else {
        const j = jobRes.data;
        setJob(j);
        setWorkflowSteps(stepsRes.data || []);
        setDocuments(docsRes.data || []);
        setTeamMembers(teamRes.data || []);
        // Pre-fill forms
        setStep1Form({
          lead_source: j.lead_source || 'manual',
          lead_source_detail: j.lead_source_detail || '',
          created_by_name: j.created_by_name || '',
          created_by_phone: j.created_by_phone || '',
          created_by_email: j.created_by_email || '',
          created_by_member_id: j.created_by_member_id || '',
        });
        setStep2Form({
          dispatched_to_name: j.dispatched_to_name || '',
          dispatched_to_phone: j.dispatched_to_phone || '',
          dispatched_to_email: j.dispatched_to_email || '',
          dispatched_at: j.dispatched_at ? j.dispatched_at.slice(0, 16) : '',
          dispatch_notes: j.dispatch_notes || '',
          eta_minutes: j.eta_minutes?.toString() || '',
          dispatched_member_id: j.dispatched_member_id || '',
        });
        setStep3Form({
          work_auth_status: j.work_auth_status || 'pending',
          work_auth_signed_by: j.work_auth_signed_by || '',
        });
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
      created_by_member_id: step1Form.created_by_member_id || null,
      updated_at: new Date().toISOString(),
    }).eq('id', job.id);
    setJob(prev => prev ? { ...prev,
      lead_source: step1Form.lead_source,
      lead_source_detail: step1Form.lead_source_detail || null,
      created_by_name: step1Form.created_by_name || null,
      created_by_phone: step1Form.created_by_phone || null,
      created_by_email: step1Form.created_by_email || null,
      created_by_member_id: step1Form.created_by_member_id || null,
    } : prev);
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
      dispatched_member_id: step2Form.dispatched_member_id || null,
      updated_at: new Date().toISOString(),
    };
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
      dispatched_member_id: step2Form.dispatched_member_id || null,
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

  // ── Stop Job ─────────────────────────────────────────────────────────────────
  const handleStopJob = async () => {
    if (!job || !stopForm.stop_reason) return;
    setStoppingJob(true);
    const now = new Date().toISOString();
    const { data: { session } } = await supabase.auth.getSession();
    const stoppedBy = session?.user?.email || 'Unknown';
    await supabase.from('jobs').update({
      stopped: true,
      stop_reason: stopForm.stop_reason,
      stop_notes: stopForm.stop_notes || null,
      stopped_at: now,
      stopped_by: stoppedBy,
      status: 'stopped',
      updated_at: now,
    }).eq('id', job.id);
    setJob(prev => prev ? { ...prev,
      stopped: true,
      stop_reason: stopForm.stop_reason,
      stop_notes: stopForm.stop_notes || null,
      stopped_at: now,
      stopped_by: stoppedBy,
      status: 'stopped',
    } : prev);
    setStoppingJob(false);
    setShowStopModal(false);
    setSaveSuccess('Job stopped and flagged.');
    setTimeout(() => setSaveSuccess(''), 4000);
  };

  // ── Override (re-activate stopped job) ───────────────────────────────────────
  const handleOverride = async () => {
    if (!job || !overrideReason.trim()) return;
    setOverriding(true);
    const now = new Date().toISOString();
    const { data: { session } } = await supabase.auth.getSession();
    const overrideBy = session?.user?.email || 'Unknown';
    await supabase.from('jobs').update({
      stopped: false,
      override_active: true,
      override_reason: overrideReason.trim(),
      override_by: overrideBy,
      override_at: now,
      status: 'active',
      updated_at: now,
    }).eq('id', job.id);
    setJob(prev => prev ? { ...prev,
      stopped: false,
      override_active: true,
      override_reason: overrideReason.trim(),
      override_by: overrideBy,
      override_at: now,
      status: 'active',
    } : prev);
    setOverriding(false);
    setShowOverrideModal(false);
    setOverrideReason('');
    setSaveSuccess('Job override approved — job is now Active.');
    setTimeout(() => setSaveSuccess(''), 4000);
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

  // ── AI Notes ──────────────────────────────────────────────────────────────────
  const generateNotes = async (saveAfter = false) => {
    if (!fieldNotes.trim()) return;
    setGeneratingNotes(true);
    setNotesError('');
    setNotesSaved(false);
    try {
      const res = await fetch('/api/notes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field_notes: fieldNotes,
          job_id: job?.id,
          save: saveAfter,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setNotesError(data.error || 'Something went wrong. Please try again.');
      } else {
        setAiNotes(data.generated);
        if (saveAfter && data.saved) {
          setJob(prev => prev ? { ...prev, notes: data.generated } : prev);
          setNotesSaved(true);
          setTimeout(() => setNotesSaved(false), 3000);
        }
      }
    } catch {
      setNotesError('Network error — please try again.');
    } finally {
      setGeneratingNotes(false);
    }
  };

  const saveAiNotes = async () => {
    if (!aiNotes.trim() || !job) return;
    setSavingNotes(true);
    setNotesError('');
    const res = await fetch('/api/notes/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        field_notes: fieldNotes,
        job_id: job.id,
        save: true,
      }),
    });
    const data = await res.json();
    if (data.saved) {
      setJob(prev => prev ? { ...prev, notes: aiNotes } : prev);
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 3000);
    } else {
      // fallback: direct Supabase update
      await supabase.from('jobs').update({ notes: aiNotes, updated_at: new Date().toISOString() }).eq('id', job.id);
      setJob(prev => prev ? { ...prev, notes: aiNotes } : prev);
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 3000);
    }
    setSavingNotes(false);
  };


  // Prevent spacebar from scrolling the page when a non-input element has focus
  const handlePageKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === ' ') {
      const tag = (e.target as HTMLElement).tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
        e.preventDefault();
      }
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-full min-h-screen bg-[#0a0f1e]">
      <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
    </div>
  );
  if (error || !job) return (
    <div className="p-6 max-w-2xl mx-auto text-center">
      <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
      <p className="text-slate-400">{error || 'Job not found.'}</p>
      <Link href="/jobs" className="text-cyan-400 hover:underline text-sm mt-2 inline-block">← Back to Jobs</Link>
    </div>
  );

  const ls = LEAD_SOURCE_ICONS[job.lead_source || 'manual'] || LEAD_SOURCE_ICONS.manual;
  const wa = WORK_AUTH_STATUS[job.work_auth_status || 'pending'] || WORK_AUTH_STATUS.pending;
  const wafDocs = documents.filter(d => d.doc_type === 'waf');
  const selectedStopReason = STOP_REASONS.find(r => r.value === job.stop_reason);

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-4" onKeyDown={handlePageKeyDown}>

      {/* ── Stop Job Modal ── */}
      {showStopModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowStopModal(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <StopCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Stop This Job</h2>
                  <p className="text-xs text-slate-500">Select a reason — this will flag the job and halt workflow progression.</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowStopModal(false)} onKeyDown={e => { if (e.key === ' ') e.preventDefault(); }}
                className="p-1.5 hover:bg-slate-700/50 rounded-lg transition"><X className="w-5 h-5 text-slate-600" /></button>
            </div>

            {/* Reason grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {STOP_REASONS.map(r => (
                <button type="button" key={r.value}
                  onClick={() => setStopForm(p => ({ ...p, stop_reason: r.value }))}
                  onKeyDown={e => { if (e.key === ' ') e.preventDefault(); }}
                  className={`text-left p-3 rounded-xl border-2 transition ${
                    stopForm.stop_reason === r.value
                      ? 'border-red-400 bg-red-50'
                      : 'border-slate-700/50 bg-slate-700/30 hover:border-gray-300 hover:bg-white'
                  }`}>
                  <div className="text-xl mb-1">{r.icon}</div>
                  <p className={`text-sm font-semibold ${stopForm.stop_reason === r.value ? 'text-red-700' : 'text-slate-200'}`}>{r.label}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">{r.description}</p>
                </button>
              ))}
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1 block">Additional Notes (optional)</label>
              <textarea value={stopForm.stop_notes}
                onChange={e => setStopForm(p => ({ ...p, stop_notes: e.target.value }))}
                rows={3} placeholder="Any additional context about why this job is being stopped…"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-400 outline-none resize-none" />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button type="button" onClick={handleStopJob}
                disabled={!stopForm.stop_reason || stoppingJob}
                onKeyDown={e => { if (e.key === ' ') e.preventDefault(); }}
                className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-lg transition text-sm">
                {stoppingJob ? <Loader2 className="w-4 h-4 animate-spin" /> : <StopCircle className="w-4 h-4" />}
                {stoppingJob ? 'Stopping…' : 'Confirm Stop Job'}
              </button>
              <button type="button" onClick={() => setShowStopModal(false)}
                onKeyDown={e => { if (e.key === ' ') e.preventDefault(); }}
                className="px-5 py-2.5 border border-gray-300 text-slate-400 text-sm rounded-lg hover:bg-slate-700/30 transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Override Modal ── */}
      {showOverrideModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowOverrideModal(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Override — Re-activate Job</h2>
                  <p className="text-xs text-slate-500">Explain why this stopped job should continue.</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowOverrideModal(false)} onKeyDown={e => { if (e.key === ' ') e.preventDefault(); }}
                className="p-1.5 hover:bg-slate-700/50 rounded-lg transition"><X className="w-5 h-5 text-slate-600" /></button>
            </div>

            {job.stop_reason && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                <p className="font-semibold">Previously stopped:</p>
                <p>{selectedStopReason?.label || job.stop_reason}</p>
                {job.stop_notes && <p className="text-xs mt-1 text-red-500">{job.stop_notes}</p>}
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-slate-300 mb-1 block">Override Reason <span className="text-red-500">*</span></label>
              <textarea value={overrideReason}
                onChange={e => setOverrideReason(e.target.value)}
                rows={3} placeholder="e.g. Client confirmed they want full restoration after reviewing estimate…"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-400 outline-none resize-none" />
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={handleOverride}
                disabled={!overrideReason.trim() || overriding}
                onKeyDown={e => { if (e.key === ' ') e.preventDefault(); }}
                className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-lg transition text-sm">
                {overriding ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {overriding ? 'Processing…' : 'Approve Override'}
              </button>
              <button type="button" onClick={() => setShowOverrideModal(false)}
                onKeyDown={e => { if (e.key === ' ') e.preventDefault(); }}
                className="px-5 py-2.5 border border-gray-300 text-slate-400 text-sm rounded-lg hover:bg-slate-700/30 transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <Link href="/jobs" className="p-2 hover:bg-slate-700/50 rounded-lg transition mt-1">
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-white">
              {JOB_TYPE_ICON[job.job_type]} {job.insured_name}
            </h1>
            <span className={`text-sm font-medium px-3 py-1 rounded-full capitalize ${STATUS_BADGE[job.status] || 'bg-slate-700/50 text-slate-400'}`}>
              {job.status}
            </span>
            {job.override_active && (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                ⚡ Override Active
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-slate-500 text-sm mt-1">
            <MapPin className="w-3.5 h-3.5" />
            {job.property_address}{job.property_city ? `, ${job.property_city}` : ''}{job.property_postal_code ? ` ${job.property_postal_code}` : ''}
          </div>
        </div>

        {/* Status select + Stop Job button */}
        <div className="flex items-center gap-2 shrink-0">
          {!job.stopped ? (
            <>
              <select value={job.status} onChange={e => updateStatus(e.target.value)} disabled={statusUpdating}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="new">New</option>
                <option value="dispatched">Dispatched</option>
                <option value="active">Active</option>
                <option value="review">In Review</option>
                <option value="closed">Closed</option>
              </select>
              <button type="button"
                onClick={() => { setStopForm({ stop_reason: '', stop_notes: '' }); setShowStopModal(true); }}
                onKeyDown={e => { if (e.key === ' ') e.preventDefault(); }}
                className="flex items-center gap-1.5 text-sm font-semibold text-red-600 border border-red-300 hover:bg-red-50 px-3 py-2 rounded-lg transition">
                <StopCircle className="w-4 h-4" /> Stop Job
              </button>
            </>
          ) : (
            <button type="button"
              onClick={() => setShowOverrideModal(true)}
              onKeyDown={e => { if (e.key === ' ') e.preventDefault(); }}
              className="flex items-center gap-1.5 text-sm font-semibold text-green-700 border border-green-300 bg-green-50 hover:bg-green-100 px-3 py-2 rounded-lg transition">
              <CheckCircle className="w-4 h-4" /> Override — Re-activate
            </button>
          )}
        </div>
      </div>

      {/* ── Stopped Job Banner ── */}
      {job.stopped && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 flex items-start gap-3">
          <StopCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-red-800">This Job Has Been Stopped</p>
            <p className="text-sm text-red-700 mt-0.5">
              <strong>Reason:</strong> {selectedStopReason?.icon} {selectedStopReason?.label || job.stop_reason}
            </p>
            {job.stop_notes && <p className="text-xs text-red-600 mt-1">{job.stop_notes}</p>}
            {job.stopped_at && <p className="text-xs text-red-500 mt-1">Stopped: {new Date(job.stopped_at).toLocaleString()} {job.stopped_by ? `by ${job.stopped_by}` : ''}</p>}
            <p className="text-xs text-red-500 mt-2 font-medium">
              📋 File remains open for reference. Click &quot;Override — Re-activate&quot; if the job should continue.
            </p>
          </div>
        </div>
      )}

      {/* ── Override info banner ── */}
      {job.override_active && !job.stopped && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800">Override Active</p>
            <p className="text-xs text-amber-700">{job.override_reason} — approved by {job.override_by} {job.override_at ? `on ${new Date(job.override_at).toLocaleDateString()}` : ''}</p>
          </div>
        </div>
      )}

      {/* Save success */}
      {saveSuccess && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg p-3">
          <CheckCircle className="w-4 h-4 shrink-0" />{saveSuccess}
        </div>
      )}

      {/* ── Job Hub Tab Bar ── */}
      <div className="border-b border-slate-700/50 bg-white sticky top-0 z-10 -mx-6 px-6">
        <div className="flex overflow-x-auto scrollbar-hide gap-1">
          {([
            { id: 'overview',   label: 'Overview',     icon: FileText  },
            { id: 'photos',     label: 'Photos',        icon: Camera    },
            { id: 'moisture',   label: 'Moisture',      icon: Droplets  },
            { id: 'floorplans', label: 'Floor Plans',   icon: Map       },
            { id: 'documents',  label: 'Documents',     icon: FilePen   },
            { id: 'xactimate', label: 'Xactimate',     icon: Calculator  },
            { id: 'thermal',    label: 'Thermal',       icon: Thermometer },
            { id: 'share',      label: 'Share',         icon: Share2      },
          ] as { id: typeof activeJobTab; label: string; icon: React.ElementType }[]).map(tab => (
            <button key={tab.id} type="button"
              onClick={() => setActiveJobTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition shrink-0 ${
                activeJobTab === tab.id
                  ? 'border-blue-600 text-cyan-300'
                  : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-gray-300'
              }`}>
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Overview Tab ── */}
      {activeJobTab === 'overview' && (<>

      {/* ── Deadline Countdowns ── */}
      <DeadlineCountdown createdAt={job.created_at} />

      {/* ── Workflow Progress Bar ── */}
      <WorkflowProgressBar steps={workflowSteps} currentStep={job.current_step} />

      {/* ── Carrier Mode Banner ── */}
      <Link
        href={`/jobs/${job.id}/carrier`}
        className={`flex items-center justify-between gap-3 rounded-xl border-2 p-4 transition hover:shadow-md ${
          job.carrier_slug
            ? 'bg-cyan-500/10 border-blue-300 hover:bg-blue-100'
            : 'bg-slate-50 border-dashed border-slate-300 hover:border-blue-400'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            job.carrier_slug ? 'bg-blue-600' : 'bg-slate-300'
          }`}>
            <Shield className={`w-5 h-5 ${job.carrier_slug ? 'text-white' : 'text-white'}`} />
          </div>
          <div>
            <p className={`font-bold text-sm ${job.carrier_slug ? 'text-blue-800' : 'text-slate-700'}`}>
              {job.carrier_slug ? '🛡️ Carrier Mode Active' : '🛡️ Activate Carrier Mode'}
            </p>
            <p className={`text-xs mt-0.5 ${job.carrier_slug ? 'text-cyan-400' : 'text-slate-500'}`}>
              {job.carrier_slug
                ? `${job.insurer_name || job.carrier_slug} — SLA timers, photo labels & checklist`
                : 'Select carrier for SLA timers, photo requirements & compliance checklist'}
            </p>
          </div>
        </div>
        <ChevronRight className={`w-5 h-5 flex-shrink-0 ${job.carrier_slug ? 'text-blue-400' : 'text-slate-400'}`} />
      </Link>

      {/* ── Dispatch to Staff ── */}
      <StaffDispatchPanel jobId={job.id} adminUserId={userId} />

      {/* ── Clickable Step Tabs ── */}
      <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 overflow-hidden">
        {/* Tab row */}
        <div className="flex overflow-x-auto border-b border-slate-700/30 bg-slate-700/30 scrollbar-hide">
          {STEP_META.map(step => {
            const status = getStepStatus(step.num);
            const isActive = activeStep === step.num;
            const isComplete = status === 'complete' || status === 'overridden';
            const isInProgress = status === 'in_progress';
            return (
              <button
                key={step.num}
                type="button"
                onClick={() => setActiveStep(isActive ? null : step.num)}
                onKeyDown={e => { if (e.key === ' ' || e.key === 'Spacebar') e.preventDefault(); }}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition whitespace-nowrap ${
                  isActive
                    ? 'border-blue-600 text-cyan-300 bg-white'
                    : isComplete
                    ? 'border-green-400 text-green-700 hover:bg-white'
                    : isInProgress
                    ? 'border-blue-400 text-cyan-400 hover:bg-white'
                    : 'border-transparent text-slate-600 hover:text-slate-400 hover:bg-white'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                  isComplete ? 'bg-green-500 text-white' :
                  isInProgress ? 'bg-cyan-500/100 text-white' :
                  'bg-gray-200 text-slate-500'
                }`}>
                  {isComplete ? '✓' : step.num}
                </span>
                {step.label}
                {isInProgress && <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/100 animate-pulse" />}
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
                  <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-cyan-400" /> Step 1 — File Creation
                    <span className="text-xs text-slate-600 font-normal">
                      Created {new Date(job.created_at).toLocaleString()}
                    </span>
                  </h3>
                  <button type="button" onClick={() => setEditingStep(editingStep === 1 ? null : 1)}
                    onKeyDown={e => { if (e.key === ' ') e.preventDefault(); }}
                    className="flex items-center gap-1 text-xs text-cyan-400 hover:text-blue-800 px-2 py-1 rounded-lg hover:bg-cyan-500/10 transition">
                    <Edit3 className="w-3.5 h-3.5" /> {editingStep === 1 ? 'Cancel' : 'Edit'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Lead Source card */}
                  <div className="bg-slate-800/40 rounded-2xl p-4 border border-slate-700/30">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Lead Source</p>
                    {/* edit form – always mounted, hidden when not editing */}
                    <div className={editingStep === 1 ? 'space-y-3' : 'hidden'}>
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
                    {/* view – hidden when editing */}
                    <div className={editingStep === 1 ? 'hidden' : ''}>
                      <span className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg ${ls.color}`}>
                        {ls.icon} {ls.label}
                      </span>
                      {job.lead_source_detail && (
                        <p className="text-xs text-slate-500 mt-2">{job.lead_source_detail}</p>
                      )}
                    </div>
                  </div>

                  {/* File Created By — with employee dropdown */}
                  <div className="bg-slate-800/40 rounded-2xl p-4 border border-slate-700/30">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">File Created By</p>
                      {teamMembers.length === 0 && editingStep !== 1 && (
                        <Link href="/settings" className="text-xs text-cyan-400 hover:underline flex items-center gap-1">
                          <Users className="w-3 h-3" /> Add team
                        </Link>
                      )}
                    </div>
                    {/* edit form – always mounted */}
                    <div className={editingStep === 1 ? 'space-y-2' : 'hidden'}>
                      {teamMembers.length > 0 && (
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block">Select from your team</label>
                          <EmployeeSelect
                            members={teamMembers}
                            selectedId={step1Form.created_by_member_id}
                            onSelect={(id, member) => {
                              setStep1Form(p => ({
                                ...p,
                                created_by_member_id: id,
                                created_by_name: member?.full_name || p.created_by_name,
                                created_by_phone: member?.cell_phone || p.created_by_phone,
                                created_by_email: member?.email || p.created_by_email,
                              }));
                            }}
                            placeholder="— Select team member —"
                          />
                          <p className="text-[10px] text-slate-600 mt-1">Or fill manually below</p>
                        </div>
                      )}
                      <input type="text" value={step1Form.created_by_name}
                        onChange={e => setStep1Form(p => ({ ...p, created_by_name: e.target.value, created_by_member_id: '' }))}
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
                    {/* view */}
                    <div className={editingStep === 1 ? 'hidden' : ''}>
                      {job.created_by_name ? (
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                              <User className="w-4 h-4 text-cyan-400" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-200">{job.created_by_name}</p>
                              {job.created_by_phone && <p className="text-xs text-slate-500">{job.created_by_phone}</p>}
                            </div>
                          </div>
                          <ContactActions phone={job.created_by_phone} email={job.created_by_email} name={job.created_by_name} />
                        </div>
                      ) : (
                        <p className="text-sm text-slate-600 italic">Not recorded — click Edit to add staff info</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Insured summary */}
                <div className="bg-slate-800/40 rounded-2xl p-4 border border-slate-700/30">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Insured / Client</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <InfoRow icon={User} label="Insured Name" value={job.insured_name} />
                    <InfoRow icon={Hash} label="Claim #" value={job.claim_number || <span className="text-gray-300">—</span>} mono />
                    <InfoRow icon={Calendar} label="Loss Date" value={job.loss_date ? new Date(job.loss_date).toLocaleDateString() : <span className="text-gray-300">—</span>} />
                  </div>
                  <ContactActions phone={job.insured_phone} email={job.insured_email} name={job.insured_name} />
                </div>

                <div className={editingStep === 1 ? '' : 'hidden'}>
                  <button type="button" onClick={saveStep1} disabled={saving}
                    className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 disabled:bg-gray-300 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save File Creation Data
                  </button>
                </div>

                {/* Advance button */}
                {getStepStatus(1) !== 'complete' && (
                  <div className="pt-2 border-t border-slate-700/30">
                    <button type="button" onClick={() => advanceWorkflowStep(1)}
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
                  <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-purple-500" /> Step 2 — Dispatch
                    {job.dispatched_at && (
                      <span className="text-xs text-slate-600 font-normal">
                        Dispatched {new Date(job.dispatched_at).toLocaleString()}
                      </span>
                    )}
                  </h3>
                  <button type="button" onClick={() => setEditingStep(editingStep === 2 ? null : 2)}
                    onKeyDown={e => { if (e.key === ' ') e.preventDefault(); }}
                    className="flex items-center gap-1 text-xs text-cyan-400 hover:text-blue-800 px-2 py-1 rounded-lg hover:bg-cyan-500/10 transition">
                    <Edit3 className="w-3.5 h-3.5" /> {editingStep === 2 ? 'Cancel' : 'Edit'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Technician dispatched to */}
                  <div className="bg-slate-800/40 rounded-2xl p-4 border border-slate-700/30">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                      Technician / Team Assigned
                    </p>
                    {/* edit form – always mounted */}
                    <div className={editingStep === 2 ? 'space-y-2' : 'hidden'}>
                      {teamMembers.length > 0 && (
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block">Select from your team</label>
                          <EmployeeSelect
                            members={teamMembers}
                            selectedId={step2Form.dispatched_member_id}
                            onSelect={(id, member) => {
                              setStep2Form(p => ({
                                ...p,
                                dispatched_member_id: id,
                                dispatched_to_name: member?.full_name || p.dispatched_to_name,
                                dispatched_to_phone: member?.cell_phone || p.dispatched_to_phone,
                                dispatched_to_email: member?.email || p.dispatched_to_email,
                              }));
                            }}
                            placeholder="— Assign a technician —"
                          />
                          <p className="text-[10px] text-slate-600 mt-1">Or fill manually below</p>
                        </div>
                      )}
                      <input type="text" value={step2Form.dispatched_to_name}
                        onChange={e => setStep2Form(p => ({ ...p, dispatched_to_name: e.target.value, dispatched_member_id: '' }))}
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
                    {/* view */}
                    <div className={editingStep === 2 ? 'hidden' : ''}>
                      {job.dispatched_to_name ? (
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center">
                              <UserCheck className="w-4 h-4 text-purple-600" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-200">{job.dispatched_to_name}</p>
                              {job.dispatched_to_phone && <p className="text-xs text-slate-500">{job.dispatched_to_phone}</p>}
                              {job.dispatched_to_email && <p className="text-xs text-slate-600">{job.dispatched_to_email}</p>}
                            </div>
                          </div>
                          <ContactActions phone={job.dispatched_to_phone} email={job.dispatched_to_email} name={job.dispatched_to_name} />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-slate-600 italic">
                          <AlertTriangle className="w-4 h-4 text-yellow-400" />
                          Not dispatched yet — click Edit to assign a technician
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dispatch timing */}
                  <div className="bg-slate-800/40 rounded-2xl p-4 border border-slate-700/30">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Dispatch Timing</p>
                    {/* edit form - timing */}
                    <div className={editingStep === 2 ? 'space-y-2' : 'hidden'}>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Dispatch Date & Time</label>
                        <input type="datetime-local" value={step2Form.dispatched_at}
                          onChange={e => setStep2Form(p => ({ ...p, dispatched_at: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">ETA (minutes)</label>
                        <input type="number" min="0" value={step2Form.eta_minutes}
                          onChange={e => setStep2Form(p => ({ ...p, eta_minutes: e.target.value }))}
                          placeholder="e.g. 45"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                    </div>
                    {/* view - timing */}
                    <div className={editingStep === 2 ? 'hidden' : 'space-y-2'}>
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
                  </div>
                </div>

                {/* Dispatch notes - always render textarea to keep focus stable */}
                <div className={editingStep === 2 || job.dispatch_notes ? 'bg-slate-800/40 rounded-2xl p-4 border border-slate-700/30' : 'hidden'}>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Dispatch Notes</p>
                  <textarea value={step2Form.dispatch_notes}
                    onChange={e => setStep2Form(p => ({ ...p, dispatch_notes: e.target.value }))}
                    rows={3} placeholder="Special instructions, access code, lockbox, etc."
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none ${editingStep !== 2 ? 'hidden' : ''}`} />
                  {editingStep !== 2 && job.dispatch_notes && (
                    <p className="text-sm text-slate-300 leading-relaxed">{job.dispatch_notes}</p>
                  )}
                </div>

                {/* Property for navigation */}
                <div className="bg-cyan-500/10 rounded-xl p-4 border border-blue-100">
                  <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wide mb-2">Property Address</p>
                  <p className="text-sm font-medium text-slate-200">
                    {job.property_address}{job.property_city ? `, ${job.property_city}` : ''}{job.property_postal_code ? ` ${job.property_postal_code}` : ''}
                  </p>
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent([job.property_address, job.property_city].filter(Boolean).join(', '))}`}
                    target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 mt-2 text-xs bg-white hover:bg-blue-100 text-cyan-300 font-medium px-3 py-1.5 rounded-lg border border-blue-200 transition">
                    <MapPin className="w-3 h-3" /> Open in Google Maps
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className={editingStep === 2 ? '' : 'hidden'}>
                  <button type="button" onClick={saveStep2} disabled={saving}
                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Dispatch Data
                  </button>
                </div>

                {getStepStatus(2) !== 'complete' && (
                  <div className="pt-2 border-t border-slate-700/30">
                    <button type="button" onClick={() => advanceWorkflowStep(2)}
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
                  <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-green-500" /> Step 3 — Work Authorization
                  </h3>
                  <button type="button" onClick={() => setEditingStep(editingStep === 3 ? null : 3)}
                    onKeyDown={e => { if (e.key === ' ') e.preventDefault(); }}
                    className="flex items-center gap-1 text-xs text-cyan-400 hover:text-blue-800 px-2 py-1 rounded-lg hover:bg-cyan-500/10 transition">
                    <Edit3 className="w-3.5 h-3.5" /> {editingStep === 3 ? 'Cancel' : 'Edit Status'}
                  </button>
                </div>

                {/* Status banner */}
                <div className={`rounded-xl p-4 border-2 flex items-center gap-3 ${
                  job.work_auth_status === 'signed' ? 'bg-green-50 border-green-300' :
                  job.work_auth_status === 'declined' ? 'bg-red-50 border-red-300' :
                  job.work_auth_status === 'sent' || job.work_auth_status === 'viewed' ? 'bg-cyan-500/10 border-blue-300' :
                  'bg-slate-700/30 border-slate-700/50'
                }`}>
                  <div className="text-3xl">{wa.icon}</div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-200">Authorization Status: <span className={`px-2 py-0.5 rounded-full text-sm ${wa.color}`}>{wa.label}</span></p>
                    {job.work_auth_sent_at && <p className="text-xs text-slate-500 mt-0.5">Sent: {new Date(job.work_auth_sent_at).toLocaleString()}</p>}
                    {job.work_auth_signed_at && <p className="text-xs text-green-600 mt-0.5">Signed: {new Date(job.work_auth_signed_at).toLocaleString()} {job.work_auth_signed_by ? `by ${job.work_auth_signed_by}` : ''}</p>}
                  </div>
                </div>

                {/* Step 3 edit form - always mounted to preserve focus */}
                <div className={editingStep === 3 ? 'bg-slate-800/40 rounded-2xl p-4 border border-slate-700/30 space-y-3' : 'hidden'}>
                    <div>
                      <label className="text-xs font-medium text-slate-400 mb-1 block">Update Authorization Status</label>
                      <select value={step3Form.work_auth_status}
                        onChange={e => setStep3Form(p => ({ ...p, work_auth_status: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                        {Object.entries(WORK_AUTH_STATUS).map(([val, meta]) => (
                          <option key={val} value={val}>{meta.icon} {meta.label}</option>
                        ))}
                      </select>
                    </div>
                    {/* signed-by input - always rendered to keep focus stable */}
                    <div className={step3Form.work_auth_status === 'signed' ? '' : 'hidden'}>
                      <label className="text-xs font-medium text-slate-400 mb-1 block">Signed By (name)</label>
                      <input type="text" value={step3Form.work_auth_signed_by}
                        onChange={e => setStep3Form(p => ({ ...p, work_auth_signed_by: e.target.value }))}
                        placeholder="e.g. John Peters"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <button type="button" onClick={saveStep3} disabled={saving}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Authorization Status
                    </button>
                  </div>

                {/* Document upload */}
                <div className="bg-slate-800/40 rounded-2xl p-4 border border-slate-700/30">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Work Authorization Form (WAF)</p>
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingDoc}
                      className="flex items-center gap-1.5 text-xs bg-cyan-500 hover:bg-cyan-400 disabled:bg-gray-300 text-white font-medium px-3 py-1.5 rounded-lg transition">
                      {uploadingDoc ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      {uploadingDoc ? 'Uploading…' : 'Upload WAF'}
                    </button>
                    <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,image/*" className="hidden" onChange={uploadWorkAuthDoc} />
                  </div>

                  {wafDocs.length === 0 ? (
                    <div className="text-center py-6 border-2 border-dashed border-slate-700/50 rounded-lg">
                      <PenTool className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-600">No WAF document uploaded yet</p>
                      <p className="text-xs text-gray-300 mt-1">Upload a signed PDF, photo of signed form, or DocuSign document</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {wafDocs.map(doc => (
                        <div key={doc.id} className="flex items-center gap-3 bg-white rounded-lg p-3 border border-slate-700/50">
                          <FileText className="w-5 h-5 text-cyan-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-200 truncate">{doc.file_name || 'Work Authorization Form'}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                doc.signed_status === 'signed' ? 'bg-green-100 text-green-700' :
                                doc.signed_status === 'declined' ? 'bg-red-100 text-red-700' :
                                'bg-slate-700/50 text-slate-500'
                              }`}>{doc.signed_status.toUpperCase()}</span>
                              <span className="text-xs text-slate-600">{new Date(doc.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <a href={doc.doc_url} target="_blank" rel="noreferrer"
                              className="p-1.5 hover:bg-slate-700/50 rounded-lg transition text-slate-500 hover:text-cyan-400">
                              <Eye className="w-4 h-4" />
                            </a>
                            <a href={doc.doc_url} download
                              className="p-1.5 hover:bg-slate-700/50 rounded-lg transition text-slate-500 hover:text-green-600">
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
                    <button type="button" className="flex items-center gap-1.5 text-xs bg-cyan-500/100/30 hover:bg-cyan-500/100/50 text-blue-200 font-medium px-3 py-1.5 rounded-lg border border-blue-400/30 transition">
                      <PenTool className="w-3 h-3" /> DocuSign (coming soon)
                    </button>
                  </div>
                </div>

                {getStepStatus(3) !== 'complete' && (
                  <div className="pt-2 border-t border-slate-700/30">
                  <button type="button"
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
                <p className="font-semibold text-slate-300 mb-1">Step {activeStep}: {STEP_META[activeStep - 1]?.label}</p>
                <p className="text-sm text-slate-600 mb-4">
                  {getStepStatus(activeStep) === 'complete' ? '✅ This step has been completed.' :
                   getStepStatus(activeStep) === 'in_progress' ? '🔵 This step is currently in progress.' :
                   '⏳ This step is pending.'}
                </p>
                {getStepStatus(activeStep) !== 'complete' && getStepStatus(activeStep) === 'in_progress' && (
                  <button type="button" onClick={() => advanceWorkflowStep(activeStep)}
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

      {/* ── AI Notes Generator ── */}
      <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-700/30 bg-gradient-to-r from-violet-50 to-blue-50">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shrink-0">
            <Sparkles className="w-4.5 h-4.5 text-white w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">AI Notes Generator</h3>
            <p className="text-xs text-slate-500">Type rough field notes → get clean professional text instantly</p>
          </div>
        </div>

        <div className="p-5 space-y-4">

          {/* Error */}
          {notesError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{notesError}</span>
            </div>
          )}

          {/* Saved confirmation */}
          {notesSaved && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg p-3">
              <CheckCircle className="w-4 h-4 shrink-0" /> Notes saved to this job successfully!
            </div>
          )}

          {/* Step 1 — Field Notes input */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              <NotebookPen className="w-3.5 h-3.5" /> Field Notes
            </label>
            <textarea
              value={fieldNotes}
              onChange={e => setFieldNotes(e.target.value)}
              rows={5}
              placeholder={`Paste or type rough tech notes here — bullets, fragments, anything…\n\nExample:\n- water came from 2nd floor bathroom\n- affected master bedroom ceiling and walls\n- cat 1 water loss, class 2\n- moisture readings 40-60% on drywall\n- extracted standing water approx 15 gallons`}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-violet-400 focus:border-violet-400 outline-none resize-none font-mono leading-relaxed text-slate-300 placeholder-gray-300"
            />
          </div>

          {/* Generate button */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => generateNotes(false)}
              disabled={!fieldNotes.trim() || generatingNotes}
              onKeyDown={e => { if (e.key === ' ') e.preventDefault(); }}
              className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-300 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition shadow-sm shadow-violet-200"
            >
              {generatingNotes
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Writing with AI…</>
                : <><Sparkles className="w-4 h-4" /> ✨ Write Notes with AI</>
              }
            </button>
            {!fieldNotes.trim() && (
              <p className="text-xs text-slate-600">Type field notes above first</p>
            )}
          </div>

          {/* Step 2 — AI Result */}
          {(aiNotes || generatingNotes) && (
            <div className="space-y-3">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                <Sparkles className="w-3.5 h-3.5 text-violet-500" /> AI-Generated Result
              </label>

              {/* Shimmer placeholder while generating */}
              {generatingNotes && !aiNotes && (
                <div className="space-y-2 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-full" />
                  <div className="h-4 bg-gray-200 rounded w-5/6" />
                  <div className="h-4 bg-gray-200 rounded w-full" />
                  <div className="h-4 bg-gray-200 rounded w-4/6" />
                  <div className="h-4 bg-gray-200 rounded w-full" />
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                </div>
              )}

              {aiNotes && (
                <>
                  <textarea
                    value={aiNotes}
                    onChange={e => setAiNotes(e.target.value)}
                    rows={7}
                    className="w-full px-4 py-3 border border-violet-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-400 outline-none resize-none leading-relaxed text-slate-200 bg-violet-50/30"
                  />
                  <p className="text-[11px] text-slate-600">✏️ You can edit the text above before saving</p>

                  {/* Action buttons */}
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={saveAiNotes}
                      disabled={savingNotes || notesSaved}
                      onKeyDown={e => { if (e.key === ' ') e.preventDefault(); }}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition"
                    >
                      {savingNotes
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                        : notesSaved
                        ? <><CheckCircle className="w-4 h-4" /> Saved!</>
                        : <><Save className="w-4 h-4" /> Save Notes</>
                      }
                    </button>
                    <button
                      type="button"
                      onClick={() => generateNotes(false)}
                      disabled={generatingNotes}
                      onKeyDown={e => { if (e.key === ' ') e.preventDefault(); }}
                      className="flex items-center gap-2 border border-violet-300 hover:bg-violet-50 text-violet-700 font-semibold text-sm px-5 py-2.5 rounded-xl transition"
                    >
                      {generatingNotes
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Regenerating…</>
                        : <><RefreshCw className="w-4 h-4" /> Regenerate</>
                      }
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Current saved notes preview */}
          {job.notes && !aiNotes && (
            <div className="bg-slate-800/40 rounded-2xl p-4 border border-slate-700/30">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Current Saved Notes</p>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{job.notes}</p>
              <button
                type="button"
                onClick={() => { setFieldNotes(job.notes || ''); setAiNotes(''); }}
                onKeyDown={e => { if (e.key === ' ') e.preventDefault(); }}
                className="mt-3 text-xs text-violet-600 hover:underline flex items-center gap-1"
              >
                <Edit3 className="w-3 h-3" /> Load into editor to rewrite with AI
              </button>
            </div>
          )}

        </div>
      </div>

      {/* ── Details Grid (always visible below) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <User className="w-4 h-4 text-cyan-400" /> Insured
          </h3>
          <div className="space-y-1">
            <InfoRow icon={User} label="Name" value={job.insured_name} />
            {job.insured_phone && <InfoRow icon={Phone} label="Phone" value={
              <a href={`tel:${job.insured_phone}`} className="text-cyan-400 hover:underline">{job.insured_phone}</a>
            } />}
            {job.insured_email && <InfoRow icon={Mail} label="Email" value={
              <a href={`mailto:${job.insured_email}`} className="text-cyan-400 hover:underline">{job.insured_email}</a>
            } />}
          </div>
          <ContactActions phone={job.insured_phone} email={job.insured_email} name={job.insured_name} />
        </div>

        <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
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
          <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-orange-500" /> Adjuster
            </h3>
            <div className="space-y-1">
              {job.adjuster_name && <InfoRow icon={User} label="Name" value={job.adjuster_name} />}
              {job.adjuster_phone && <InfoRow icon={Phone} label="Phone" value={
                <a href={`tel:${job.adjuster_phone}`} className="text-cyan-400 hover:underline">{job.adjuster_phone}</a>
              } />}
              {job.adjuster_email && <InfoRow icon={Mail} label="Email" value={
                <a href={`mailto:${job.adjuster_email}`} className="text-cyan-400 hover:underline">{job.adjuster_email}</a>
              } />}
            </div>
            <ContactActions phone={job.adjuster_phone} email={job.adjuster_email} name={job.adjuster_name} />
          </div>
        )}

        {job.notes && (
          <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-2">Notes</h3>
            <p className="text-sm text-slate-400 leading-relaxed">{job.notes}</p>
          </div>
        )}
      </div>

      <div className="text-xs text-slate-600 flex gap-4 pb-4">
        <span>Created: {new Date(job.created_at).toLocaleString()}</span>
        <span>Updated: {new Date(job.updated_at).toLocaleString()}</span>
      </div>

      </>)}

      {/* ── Photos Tab ── */}
      {activeJobTab === 'photos' && (
        <div className="py-2">
          <JobPhotosTab jobId={job.id} userId={userId} />
        </div>
      )}

      {/* ── Moisture Tab ── */}
      {activeJobTab === 'moisture' && (
        <div className="py-2">
          <JobMoistureTab jobId={job.id} userId={userId} />
        </div>
      )}

      {/* ── Floor Plans Tab ── */}
      {activeJobTab === 'floorplans' && (
        <div className="py-2">
          <JobFloorPlanTab
            jobId={job.id}
            userId={userId}
            jobData={{
              insured_name:     job.insured_name,
              property_address: job.property_address,
              claim_number:     job.claim_number    ?? undefined,
              insurer_name:     job.insurer_name    ?? undefined,
              job_type:         job.job_type,
            }}
          />
        </div>
      )}

      {/* ── Documents Tab ── */}
      {activeJobTab === 'documents' && (
        <div className="py-2">
          <JobDocumentsTab
            jobId={job.id}
            jobData={{
              id: job.id,
              contact_name: job.insured_name ?? null,
              contact_phone: job.insured_phone ?? null,
              contact_email: job.insured_email ?? null,
              address: job.property_address ?? null,
              claim_number: job.claim_number ?? null,
              insurance_company: job.insurer_name ?? null,
              adjuster_name: job.adjuster_name ?? null,
              adjuster_phone: job.adjuster_phone ?? null,
              date_of_loss: job.loss_date ?? null,
            }}
          />
        </div>
      )}

      {/* ── Xactimate Tab ── */}
      {activeJobTab === 'xactimate' && (
        <div className="py-2">
          <JobXactimateTab jobId={job.id} userId={userId} />
        </div>
      )}

      {/* ── Thermal Tab ── */}
      {activeJobTab === 'thermal' && (
        <div className="py-2">
          <JobThermalTab jobId={job.id} userId={userId} />
        </div>
      )}

      {/* ── Share Tab ── */}
      {activeJobTab === 'share' && (
        <div className="py-2">
          <JobShareTab jobId={job.id} userId={userId} />
        </div>
      )}

    </div>
  );
}

// ─── Staff Dispatch Panel ─────────────────────────────────────────────────────
function StaffDispatchPanel({ jobId, adminUserId }: { jobId: string; adminUserId: string }) {
  const [teamMembers, setTeamMembers] = useState<{id:string;full_name:string;role:string}[]>([]);
  const [assignments, setAssignments] = useState<{id:string;member_id:string;status:string;dispatch_notes:string|null;member_name:string}[]>([]);
  const [selectedMember, setSelectedMember] = useState('');
  const [dispatchNote, setDispatchNote]     = useState('');
  const [saving, setSaving] = useState(false);
  const [open, setOpen]     = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: members } = await supabase
        .from('team_members').select('id, full_name, role')
        .eq('user_id', adminUserId).eq('is_active', true)
        .not('auth_user_id', 'is', null);
      if (members) setTeamMembers(members);

      const { data: assigns } = await supabase
        .from('job_assignments')
        .select('id, member_id, status, dispatch_notes, team_members(full_name)')
        .eq('job_id', jobId);
      if (assigns) {
        setAssignments(assigns.map((a: any) => ({
          ...a, member_name: a.team_members?.full_name || 'Unknown',
        })));
      }
    };
    load();
  }, [jobId, adminUserId]);

  const dispatch = async () => {
    if (!selectedMember) return;
    setSaving(true);
    await supabase.from('job_assignments').upsert({
      job_id: jobId, member_id: selectedMember,
      assigned_by: adminUserId, dispatch_notes: dispatchNote || null,
      status: 'dispatched',
    }, { onConflict: 'job_id,member_id' });

    const { data: assigns } = await supabase
      .from('job_assignments')
      .select('id, member_id, status, dispatch_notes, team_members(full_name)')
      .eq('job_id', jobId);
    if (assigns) setAssignments(assigns.map((a: any) => ({ ...a, member_name: a.team_members?.full_name || 'Unknown' })));
    setSelectedMember(''); setDispatchNote(''); setSaving(false);
  };

  const STATUS_COLORS: Record<string,string> = {
    dispatched: 'bg-blue-100 text-cyan-300', accepted: 'bg-teal-100 text-teal-700',
    in_progress: 'bg-yellow-100 text-yellow-700', completed: 'bg-green-100 text-green-700',
    declined: 'bg-red-100 text-red-700',
  };

  return (
    <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-700/30 transition">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-teal-100 flex items-center justify-center">
            <Users className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-sm text-slate-200">👷 Dispatch to Staff</p>
            <p className="text-xs text-slate-500">
              {assignments.length > 0
                ? `${assignments.length} staff assigned`
                : 'Assign technicians to this job'}
            </p>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-600 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-slate-700/30 p-4 space-y-4">
          {/* Current assignments */}
          {assignments.length > 0 && (
            <div className="space-y-2">
              {assignments.map(a => (
                <div key={a.id} className="flex items-center justify-between bg-slate-700/30 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-teal-600 flex items-center justify-center text-white text-xs font-bold">
                      {a.member_name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200">{a.member_name}</p>
                      {a.dispatch_notes && <p className="text-xs text-slate-500">{a.dispatch_notes}</p>}
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[a.status] || 'bg-slate-700/50 text-slate-400'}`}>
                    {a.status.replace('_',' ').toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Assign new */}
          <div className="space-y-2">
            <select value={selectedMember} onChange={e => setSelectedMember(e.target.value)}
              className="w-full border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-300 bg-white focus:ring-2 focus:ring-teal-500 outline-none">
              <option value="">— Select staff member —</option>
              {teamMembers
                .filter(m => !assignments.find(a => a.member_id === m.id))
                .map(m => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} ({m.role.replace('_',' ')})
                  </option>
                ))}
            </select>
            <input type="text" value={dispatchNote} onChange={e => setDispatchNote(e.target.value)}
              placeholder="Dispatch notes (optional)..."
              className="w-full border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-300 focus:ring-2 focus:ring-teal-500 outline-none" />
            <button onClick={dispatch} disabled={!selectedMember || saving}
              className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 text-white text-sm font-semibold py-2 rounded-lg transition">
              <Send className="w-4 h-4" />
              {saving ? 'Dispatching...' : 'Dispatch to Staff'}
            </button>
            {teamMembers.filter(m => !assignments.find(a => a.member_id === m.id)).length === 0 && (
              <p className="text-xs text-slate-600 text-center">
                No staff with linked accounts yet. Go to Settings → Team to invite staff.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
