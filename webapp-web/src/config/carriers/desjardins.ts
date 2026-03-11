import { CarrierProfile } from '@/types/carriers';
export const desjardinConfig: CarrierProfile = {
  id: 'desjardins-gi', insurer_name: 'Desjardins General Insurance', carrier_slug: 'desjardins',
  claims_platform: 'Cotality/Symbility', secondary_platform: 'Xactimate',
  tpa_name: 'Alacrity (if assigned)', vendor_program_name: 'Desjardins Vendor Program',
  vendor_onboarding_url: 'https://www.desjardins.com/ca/about-us/supplier-centre/supplier-relations/',
  vendor_phone: '1-800-224-7737',
  report_24hr_deadline_hours: 24, scope_deadline_days: 7, equipment_max_days: 3,
  requires_daily_logs: true, emergency_contact_deadline_minutes: 120,
  site_arrival_deadline_minutes: 240, estimate_deadline_hours: 168,
  estimate_revision_hours: 24, final_invoice_deadline_days: 7,
  requires_24hr_report: true, requires_hazmat_3stage_photos: false,
  requires_moisture_mapper_complete: false, requires_drybook: false, requires_ecoclaim_cert: false,
  export_format: 'ESX_XML',
  priority_score: 5, market_share_pct: 10.35, carrier_color: '#009A44', is_active: true,
  notes: 'Second largest Canadian carrier. Quebec-headquartered. If Alacrity TPA assigned, submit ALL docs to Alacrity portal.',
};
