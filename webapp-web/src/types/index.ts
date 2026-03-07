// ─── Core Enums ──────────────────────────────────────────────
export type JobType = 'water_loss' | 'fire_loss' | 'mold' | 'large_loss' | 'other';
export type JobStatus = 'new' | 'dispatched' | 'active' | 'review' | 'closed' | 'draft';
export type SubscriptionTier = 'free' | 'starter' | 'pro' | 'enterprise';
export type UserRole = 'admin' | 'estimator' | 'lead_tech' | 'tech';
export type WorkflowStepStatus = 'pending' | 'in_progress' | 'complete' | 'overridden' | 'skipped';

// ─── User / Profile ───────────────────────────────────────────
export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
  role: UserRole;
  subscription_tier: SubscriptionTier;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Job ─────────────────────────────────────────────────────
export interface Job {
  id: string;
  user_id: string;
  claim_number?: string | null;
  insured_name: string;
  insured_phone?: string | null;
  insured_email?: string | null;
  property_address: string;
  property_city?: string | null;
  property_postal_code?: string | null;
  loss_date?: string | null;
  loss_category?: number | null;
  loss_class?: number | null;
  job_type: JobType;
  status: JobStatus;
  current_step: number;
  insurer_name?: string | null;
  adjuster_name?: string | null;
  adjuster_email?: string | null;
  adjuster_phone?: string | null;
  lead_tech_id?: string | null;
  notes?: string | null;
  gps_lat?: number | null;
  gps_lng?: number | null;
  created_at: string;
  updated_at: string;
}

// ─── Workflow Steps ───────────────────────────────────────────
export interface WorkflowStep {
  id: string;
  job_id: string;
  step_number: number;
  step_name: string;
  status: WorkflowStepStatus;
  completed_at?: string | null;
  completed_by?: string | null;
  override_reason?: string | null;
  overridden_by?: string | null;
  created_at: string;
  updated_at: string;
}

export const WORKFLOW_STEP_NAMES: string[] = [
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

// ─── Labels & Display Helpers ────────────────────────────────
export const JOB_TYPE_LABELS: Record<JobType, string> = {
  water_loss: 'Water Loss',
  fire_loss:  'Fire Loss',
  mold:       'Mold',
  large_loss: 'Large Loss',
  other:      'Other',
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  new:        'New',
  dispatched: 'Dispatched',
  active:     'Active',
  review:     'In Review',
  closed:     'Closed',
  draft:      'Draft',
};

export const JOB_STATUS_COLORS: Record<JobStatus, string> = {
  new:        'bg-blue-100 text-blue-700',
  dispatched: 'bg-purple-100 text-purple-700',
  active:     'bg-green-100 text-green-700',
  review:     'bg-yellow-100 text-yellow-700',
  closed:     'bg-gray-100 text-gray-500',
  draft:      'bg-gray-100 text-gray-400',
};

export const JOB_TYPE_ICONS: Record<JobType, string> = {
  water_loss: '💧',
  fire_loss:  '🔥',
  mold:       '🌿',
  large_loss: '🏗️',
  other:      '📋',
};

export const WORKFLOW_STATUS_COLORS: Record<WorkflowStepStatus, string> = {
  complete:    'bg-green-100 text-green-700 border-green-300',
  in_progress: 'bg-blue-100 text-blue-700 border-blue-300',
  overridden:  'bg-orange-100 text-orange-700 border-orange-300',
  skipped:     'bg-yellow-100 text-yellow-700 border-yellow-300',
  pending:     'bg-gray-50 text-gray-400 border-gray-200',
};
