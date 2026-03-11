import { CarrierProfile } from '@/types/carriers';
export const definityConfig: CarrierProfile = {
  id: 'definity-economical', insurer_name: 'Definity Financial (Economical)', carrier_slug: 'definity',
  claims_platform: 'Cotality/Symbility', secondary_platform: 'Contractor Connection Portal',
  tpa_name: 'Contractor Connection', vendor_program_name: 'Definity/Economical Vendor Network (via Contractor Connection)',
  vendor_onboarding_url: 'https://www.contractorconnection.com/for-contractors',
  vendor_phone: '1-888-708-0002',
  report_24hr_deadline_hours: 24, scope_deadline_days: 7, equipment_max_days: 3,
  requires_daily_logs: true, emergency_contact_deadline_minutes: 60,
  site_arrival_deadline_minutes: 240, estimate_deadline_hours: 168,
  estimate_revision_hours: 24, final_invoice_deadline_days: 7,
  requires_24hr_report: true, requires_hazmat_3stage_photos: false,
  requires_moisture_mapper_complete: false, requires_drybook: false, requires_ecoclaim_cert: false,
  export_format: 'ESX_XML',
  priority_score: 4, market_share_pct: 4.0, carrier_color: '#FF6600', is_active: true,
  notes: 'Uses Contractor Connection TPA. All docs go through CC portal. Post-Travelers acquisition: market share growing rapidly.',
};
