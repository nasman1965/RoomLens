import { CarrierProfile } from '@/types/carriers';
export const avivaConfig: CarrierProfile = {
  id: 'aviva-canada', insurer_name: 'Aviva Canada', carrier_slug: 'aviva',
  claims_platform: 'CoreLogic Workspace', secondary_platform: 'Xactimate',
  vendor_program_name: 'Aviva Premier Network',
  vendor_onboarding_url: 'https://www.aviva.ca/en/business/risk-management/our-specialist-partner-network/',
  vendor_phone: '1-800-387-4518',
  report_24hr_deadline_hours: 24, scope_deadline_days: 5, equipment_max_days: 3,
  requires_daily_logs: true, emergency_contact_deadline_minutes: 30,
  site_arrival_deadline_minutes: 120, estimate_deadline_hours: 48,
  estimate_revision_hours: 24, final_invoice_deadline_days: 7,
  requires_24hr_report: true, requires_hazmat_3stage_photos: true,
  requires_moisture_mapper_complete: false, requires_drybook: false, requires_ecoclaim_cert: false,
  export_format: 'CORELOGIC',
  priority_score: 5, market_share_pct: 7.2, carrier_color: '#E30613', is_active: true,
  notes: 'STRICTEST SLAs in Canada. 30-min emergency contact. Hazmat 3-stage photos mandatory. Ovation: 24hr estimate / 5-day scope.',
};
