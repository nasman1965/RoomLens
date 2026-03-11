import { CarrierProfile } from '@/types/carriers';
export const cooperatorsConfig: CarrierProfile = {
  id: 'cooperators-canada', insurer_name: 'The Co-operators', carrier_slug: 'cooperators',
  claims_platform: 'Xactimate + Symbility',
  vendor_program_name: 'Co-operators Claims Vendor Network',
  vendor_onboarding_url: 'https://www.cooperators.ca/en/accounts-services/make-a-claim/claims-vendor',
  vendor_phone: '1-800-265-2662', vendor_email: 'Inquiries_cvm@cooperators.ca',
  report_24hr_deadline_hours: 24, scope_deadline_days: 7, equipment_max_days: 3,
  requires_daily_logs: true, emergency_contact_deadline_minutes: 60,
  site_arrival_deadline_minutes: 240, estimate_deadline_hours: 168,
  estimate_revision_hours: 24, final_invoice_deadline_days: 7,
  requires_24hr_report: false, requires_hazmat_3stage_photos: false,
  requires_moisture_mapper_complete: false, requires_drybook: false, requires_ecoclaim_cert: false,
  export_format: 'ESX_XML',
  priority_score: 5, market_share_pct: 5.6, carrier_color: '#0066CC', is_active: true,
  notes: 'Strong Ontario/Ottawa presence. 1-hour emergency contact. Vendor onboarding via email: Inquiries_cvm@cooperators.ca',
};
