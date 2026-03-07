'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import WorkflowProgressBar, { type WorkflowStep } from '@/components/WorkflowProgressBar';
import DeadlineCountdown from '@/components/DeadlineCountdown';
import {
  ArrowLeft, MapPin, Phone, Mail, User, Calendar,
  FileText, Hash, Building2, Loader2, AlertCircle, CheckCircle
} from 'lucide-react';

interface Job {
  id: string;
  insured_name: string;
  insured_phone: string | null;
  insured_email: string | null;
  property_address: string;
  property_city: string | null;
  property_postal_code: string | null;
  claim_number: string | null;
  insurer_name: string | null;
  loss_date: string | null;
  loss_category: number | null;
  loss_class: number | null;
  job_type: string;
  status: string;
  current_step: number;
  adjuster_name: string | null;
  adjuster_email: string | null;
  adjuster_phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_BADGE: Record<string, string> = {
  new:        'bg-blue-100 text-blue-700',
  dispatched: 'bg-purple-100 text-purple-700',
  active:     'bg-green-100 text-green-700',
  review:     'bg-yellow-100 text-yellow-700',
  closed:     'bg-gray-100 text-gray-500',
  draft:      'bg-gray-100 text-gray-400',
};

const JOB_TYPE_ICON: Record<string, string> = {
  water_loss: '💧',
  fire_loss:  '🔥',
  mold:       '🌿',
  large_loss: '🏗️',
  other:      '📋',
};

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);

  useEffect(() => {
    const fetchJob = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const [jobRes, stepsRes] = await Promise.all([
        supabase.from('jobs').select('*').eq('id', id).eq('user_id', session.user.id).single(),
        supabase.from('workflow_steps').select('*').eq('job_id', id).order('step_number'),
      ]);

      if (jobRes.error || !jobRes.data) {
        setError('Job not found or access denied.');
      } else {
        setJob(jobRes.data);
        setWorkflowSteps(stepsRes.data || []);
      }
      setLoading(false);
    };
    if (id) fetchJob();
  }, [id, router]);

  const updateStatus = async (newStatus: string) => {
    if (!job) return;
    setStatusUpdating(true);
    const { error: err } = await supabase
      .from('jobs')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', job.id);
    if (!err) {
      setJob(prev => prev ? { ...prev, status: newStatus } : prev);
    }
    setStatusUpdating(false);
  };

  const advanceWorkflowStep = async (stepNumber: number) => {
    if (!job) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Mark current step complete
    await supabase.from('workflow_steps')
      .update({
        status: 'complete',
        completed_at: new Date().toISOString(),
        completed_by: session.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('job_id', job.id)
      .eq('step_number', stepNumber);

    // Mark next step in_progress
    if (stepNumber < 15) {
      await supabase.from('workflow_steps')
        .update({ status: 'in_progress', updated_at: new Date().toISOString() })
        .eq('job_id', job.id)
        .eq('step_number', stepNumber + 1);

      // Update job current_step
      await supabase.from('jobs')
        .update({ current_step: stepNumber + 1, updated_at: new Date().toISOString() })
        .eq('id', job.id);

      setJob(prev => prev ? { ...prev, current_step: stepNumber + 1 } : prev);
    }

    // Refresh steps
    const { data: updatedSteps } = await supabase
      .from('workflow_steps')
      .select('*')
      .eq('job_id', job.id)
      .order('step_number');
    setWorkflowSteps(updatedSteps || []);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <p className="text-gray-600">{error || 'Job not found.'}</p>
        <Link href="/jobs" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
          ← Back to Jobs
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
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
        {/* Status Update */}
        <div className="flex items-center gap-2">
          <select
            value={job.status}
            onChange={e => updateStatus(e.target.value)}
            disabled={statusUpdating}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="new">New</option>
            <option value="dispatched">Dispatched</option>
            <option value="active">Active</option>
            <option value="review">In Review</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Deadline Countdowns */}
      <DeadlineCountdown createdAt={job.created_at} />

      {/* Workflow Progress Bar */}
      <WorkflowProgressBar steps={workflowSteps} currentStep={job.current_step} />

      {/* Advance Step Button */}
      {job.current_step < 15 && (
        <div className="flex justify-end">
          <button
            onClick={() => advanceWorkflowStep(job.current_step)}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition"
          >
            <CheckCircle className="w-4 h-4" />
            Complete Step {job.current_step} → Advance to Step {job.current_step + 1}
          </button>
        </div>
      )}

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Insured Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-blue-500" /> Insured Information
          </h3>
          <div className="space-y-2.5 text-sm">
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-gray-800 font-medium">{job.insured_name}</span>
            </div>
            {job.insured_phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-gray-400" />
                <a href={`tel:${job.insured_phone}`} className="text-blue-600 hover:underline">{job.insured_phone}</a>
              </div>
            )}
            {job.insured_email && (
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-gray-400" />
                <a href={`mailto:${job.insured_email}`} className="text-blue-600 hover:underline">{job.insured_email}</a>
              </div>
            )}
          </div>
        </div>

        {/* Claim Details */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-green-500" /> Claim Details
          </h3>
          <div className="space-y-2 text-sm">
            {job.claim_number && (
              <div className="flex items-center gap-2">
                <Hash className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-700">Claim: <strong>{job.claim_number}</strong></span>
              </div>
            )}
            {job.insurer_name && (
              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-700">{job.insurer_name}</span>
              </div>
            )}
            {job.loss_date && (
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-700">Loss Date: {new Date(job.loss_date).toLocaleDateString()}</span>
              </div>
            )}
            {job.loss_category && (
              <div className="text-gray-600">
                <span className="font-medium">Cat {job.loss_category}</span> / <span className="font-medium">Class {job.loss_class}</span>
              </div>
            )}
          </div>
        </div>

        {/* Adjuster Info */}
        {(job.adjuster_name || job.adjuster_email || job.adjuster_phone) && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-orange-500" /> Adjuster
            </h3>
            <div className="space-y-2 text-sm">
              {job.adjuster_name && (
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-gray-800 font-medium">{job.adjuster_name}</span>
                </div>
              )}
              {job.adjuster_phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                  <a href={`tel:${job.adjuster_phone}`} className="text-blue-600 hover:underline">{job.adjuster_phone}</a>
                </div>
              )}
              {job.adjuster_email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-gray-400" />
                  <a href={`mailto:${job.adjuster_email}`} className="text-blue-600 hover:underline">{job.adjuster_email}</a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        {job.notes && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Notes</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{job.notes}</p>
          </div>
        )}
      </div>

      {/* Timestamps */}
      <div className="text-xs text-gray-400 flex gap-4 pb-4">
        <span>Created: {new Date(job.created_at).toLocaleString()}</span>
        <span>Updated: {new Date(job.updated_at).toLocaleString()}</span>
      </div>
    </div>
  );
}
