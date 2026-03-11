// ============================================================
// RoomLens Pro — Carrier Config: The Commonwell Mutual
// File: src/config/carriers/commonwell.ts
// ============================================================
import { CarrierProfile } from '@/types/carriers';

export const commonwellConfig: CarrierProfile = {
  id: 'commonwell',
  insurer_name: 'The Commonwell Mutual Insurance Group',
  carrier_slug: 'commonwell',

  // Platform
  claims_platform: 'Xactimate',
  secondary_platform: 'Guidewire ClaimCenter (internal)',

  // TPA & Program
  tpa_name: 'ClaimsPro (after-hours TPA)',
  vendor_program_name: 'ACE — Accredited Commonwell Experts',
  vendor_onboarding_url: 'https://thecommonwell.ca/making-a-claim/',
  vendor_phone: '1-855-436-5883',
  vendor_email: 'generalmailbox@thecommonwell.ca',

  // SLA Deadlines
  emergency_contact_deadline_minutes: 120,   // 2 hours
  site_arrival_deadline_minutes:      240,   // 4 hours
  estimate_deadline_hours:            168,   // 7 days
  estimate_revision_hours:            48,
  final_invoice_deadline_days:        7,
  report_24hr_deadline_hours:         24,
  scope_deadline_days:                7,
  equipment_max_days:                 3,

  // Requirements
  requires_daily_logs:              true,
  requires_24hr_report:             false,
  requires_hazmat_3stage_photos:    false,
  requires_moisture_mapper_complete: false,
  requires_drybook:                 false,
  requires_ecoclaim_cert:           false,
  xactanalysis_integration:         false,
  preferred_contact_method:         'phone',

  // Export
  export_format: 'ESX_XML',

  // Identity
  priority_score:   3,
  market_share_pct: 2.1,
  carrier_color:    '#1B4F8A',
  is_active:        true,

  notes: 'Regional Ontario mutual (Lindsay + Perth HQ). ACE program vendor list. After-hours via ClaimsPro 24/7. Rural Eastern Ontario focus — Kawartha Lakes, Lanark, Renfrew. Direct adjuster relationship — no portal needed.',
};
