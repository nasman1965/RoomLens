export type JobType = 'water_loss' | 'fire_loss' | 'mold' | 'large_loss' | 'other';
export type JobStatus = 'draft' | 'active' | 'complete' | 'invoiced';
export type SubscriptionTier = 'free' | 'starter' | 'pro' | 'enterprise';

export interface UserProfile {
  id: string;
  email: string;
  company_name: string;
  subscription_tier: SubscriptionTier;
  created_at: string;
}

export interface Job {
  id: string;
  user_id: string;
  property_address: string;
  gps_lat?: number;
  gps_lng?: number;
  job_type: JobType;
  status: JobStatus;
  notes?: string;
  created_at: string;
}

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  water_loss: 'Water Loss',
  fire_loss: 'Fire Loss',
  mold: 'Mold',
  large_loss: 'Large Loss',
  other: 'Other',
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  complete: 'Complete',
  invoiced: 'Invoiced',
};

export const JOB_STATUS_COLORS: Record<JobStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  active: 'bg-blue-100 text-blue-700',
  complete: 'bg-green-100 text-green-700',
  invoiced: 'bg-purple-100 text-purple-700',
};

export const JOB_TYPE_ICONS: Record<JobType, string> = {
  water_loss: '💧',
  fire_loss: '🔥',
  mold: '🌿',
  large_loss: '🏢',
  other: '📋',
};
