// ============================================================
// RoomLens Pro — Carrier Mode TypeScript Types
// File: src/types/carriers.ts
// ============================================================

export type CarrierSlug =
  | 'intact'
  | 'aviva'
  | 'desjardins'
  | 'cooperators'
  | 'definity'
  | 'commonwell'
  | 'other';

export type ExportFormat = 'ESX_XML' | 'CORELOGIC' | 'DRYBOOK' | 'INTERNAL';

export type StepCategory = 'photo' | 'document' | 'action' | 'warning';

export type SLATimerStatus = 'pending' | 'completed' | 'overdue' | 'warning';

export type UploadStatus = 'required' | 'uploaded' | 'approved' | 'rejected';

export interface CarrierProfile {
  id: string;
  insurer_name: string;
  carrier_slug: CarrierSlug;
  claims_platform: string;
  secondary_platform?: string;
  tpa_name?: string;
  vendor_program_name?: string;
  vendor_onboarding_url?: string;
  vendor_phone?: string;
  vendor_email?: string;
  report_24hr_deadline_hours: number;
  scope_deadline_days: number;
  equipment_max_days: number;
  requires_daily_logs: boolean;
  emergency_contact_deadline_minutes: number;
  site_arrival_deadline_minutes: number;
  estimate_deadline_hours: number;
  estimate_revision_hours: number;
  final_invoice_deadline_days: number;
  requires_24hr_report: boolean;
  requires_hazmat_3stage_photos: boolean;
  requires_moisture_mapper_complete: boolean;
  min_moisture_score?: number;
  requires_drybook: boolean;
  requires_ecoclaim_cert: boolean;
  export_format: ExportFormat;
  xactanalysis_integration?: boolean;
  preferred_contact_method?: string;
  priority_score: number;
  market_share_pct?: number;
  carrier_color: string;
  carrier_logo_url?: string;
  is_active: boolean;
  notes?: string;
}

export interface CarrierChecklistItem {
  id: string;
  carrier_slug: CarrierSlug;
  step_number: number;
  step_category: StepCategory;
  step_title: string;
  step_description?: string;
  is_required: boolean;
  trigger_condition?: string;
  photo_label?: string;
  photo_direction?: string;
  warning_message?: string;
  blocking: boolean;
  sort_order: number;
  completed?: boolean;
  completed_at?: string;
  completed_by?: string;
}

export interface CarrierSLATimer {
  id: string;
  job_id: string;
  carrier_slug: CarrierSlug;
  timer_name: string;
  deadline_at: string;
  status: SLATimerStatus;
  completed_at?: string;
  completed_by?: string;
  notified_at?: string;
  created_at: string;
  minutes_remaining?: number;
  hours_remaining?: number;
  is_critical?: boolean;
  is_warning?: boolean;
}

export interface CarrierJobFile {
  id: string;
  job_id: string;
  carrier_slug: CarrierSlug;
  file_category: string;
  file_name?: string;
  storage_path?: string;
  uploaded_by?: string;
  upload_status: UploadStatus;
  carrier_notes?: string;
  uploaded_at?: string;
  created_at: string;
}

export interface CarrierSelectOption {
  value: CarrierSlug;
  label: string;
  color: string;
  marketShare?: number;
  platform: string;
  priorityScore: number;
  isEmergency: boolean;
}

export const CARRIER_COLORS: Record<CarrierSlug, string> = {
  intact:      '#003DA5',
  aviva:       '#E30613',
  desjardins:  '#009A44',
  cooperators: '#0066CC',
  definity:    '#FF6600',
  commonwell:  '#1B4F8A',
  other:       '#64748b',
};

export const CARRIER_NAMES: Record<CarrierSlug, string> = {
  intact:      'Intact Insurance',
  aviva:       'Aviva Canada',
  desjardins:  'Desjardins General Insurance',
  cooperators: 'The Co-operators',
  definity:    'Definity Financial (Economical)',
  commonwell:  'The Commonwell Mutual',
  other:       'Other Carrier',
};
