import { JobType, MaterialType, CameraType } from '../constants/app';

// ─── Auth ────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  company_name: string;
  subscription_tier: 'free' | 'starter' | 'pro' | 'enterprise';
  created_at: string;
}

// ─── Job ─────────────────────────────────────────────────────────────────────
export interface Job {
  id: string;
  user_id: string;
  property_address: string;
  gps_lat?: number;
  gps_lng?: number;
  job_type: JobType;
  status: 'draft' | 'active' | 'pending' | 'complete';
  notes?: string;
  created_at: string;
}

export interface Room {
  id: string;
  job_id: string;
  room_name: string;
  room_type: string;
  floor_number: number;
  area_sqft?: number;
}

// ─── Floor Plan ──────────────────────────────────────────────────────────────
export interface FloorPlanScan {
  id: string;
  job_id: string;
  image_360_url: string;
  floor_plan_svg_url?: string;
  scale_factor?: number;
  processed_at?: string;
  status: 'uploading' | 'processing' | 'complete' | 'error';
  rooms: RoomScanResult[];
}

export interface RoomScanResult {
  room_id: string;
  room_name: string;
  width_m: number;
  length_m: number;
  height_m: number;
  area_sqft: number;
  polygon_points: string; // SVG polygon points string
}

// ─── Moisture ─────────────────────────────────────────────────────────────────
export interface MoistureReading {
  id: string;
  job_id: string;
  room_id?: string;
  x_coord: number;         // % of floor plan width (0–100)
  y_coord: number;         // % of floor plan height (0–100)
  material_type: MaterialType;
  mc_percent: number;
  rh_percent?: number;
  temp_c?: number;
  surface_temp?: number;
  reading_date: string;
  visit_day: number;
  technician_id: string;
  status: 'green' | 'yellow' | 'red';
}

export interface DryingVisit {
  id: string;
  job_id: string;
  visit_number: number;
  visit_date: string;
  notes?: string;
  technician_id: string;
  readings: MoistureReading[];
}

// ─── Photos ───────────────────────────────────────────────────────────────────
export interface DamagePhoto {
  id: string;
  job_id: string;
  room_id?: string;
  photo_url: string;
  annotated_url?: string;
  room_tag?: string;
  damage_tag?: 'water' | 'fire' | 'mold' | 'structural' | 'pre_existing';
  ai_analysis_json?: AIPhotoAnalysis;
  timestamp: string;
  gps_lat?: number;
  gps_lng?: number;
  floor?: string;
  area?: string;
  technician_id?: string;
}

export interface AIPhotoAnalysis {
  material_type: string;
  damage_type: string;
  severity: 'low' | 'moderate' | 'severe';
  xactimate_line_items: XactimateLineItem[];
  confidence: number;
  notes?: string;
}

// ─── Estimate ─────────────────────────────────────────────────────────────────
export interface XactimateLineItem {
  code: string;
  description: string;
  unit: string;
  estimated_quantity: number;
  selected: boolean;
  room?: string;
}

export interface Estimate {
  id: string;
  job_id: string;
  ai_draft_json: XactimateLineItem[];
  reviewed_by?: string;
  status: 'draft' | 'reviewed' | 'exported';
  xactimate_line_items_json?: XactimateLineItem[];
}

// ─── Reports ──────────────────────────────────────────────────────────────────
export interface Report {
  id: string;
  job_id: string;
  report_type: 'full' | 'floor_plan' | 'moisture' | 'photos' | 'estimate';
  pdf_url?: string;
  generated_at: string;
  shared_via?: 'email' | 'whatsapp' | 'sms' | 'link';
}

// ─── Camera / OSC ─────────────────────────────────────────────────────────────
export interface CameraState {
  connected: boolean;
  cameraType: CameraType;
  batteryLevel?: number;
  remainingSpace?: number;
  model?: string;
  ip: string;
}

export interface OSCCommandResult {
  success: boolean;
  fileUrl?: string;
  error?: string;
  commandId?: string;
}

// ─── Navigation ───────────────────────────────────────────────────────────────
export type RootStackParamList = {
  '(auth)/splash': undefined;
  '(auth)/login': undefined;
  '(auth)/signup': undefined;
  '(auth)/forgot-password': undefined;
  '(tabs)': undefined;
  'job/[id]': { id: string };
  'job/new': undefined;
  'floorplan/[jobId]': { jobId: string };
  'moisture/[jobId]': { jobId: string };
  'photos/[jobId]': { jobId: string };
  'estimate/[jobId]': { jobId: string };
  'settings': undefined;
};
