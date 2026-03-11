import { CarrierProfile } from '@/types/carriers';
export const intactConfig: CarrierProfile = {
  id: 'intact-canada', insurer_name: 'Intact Insurance', carrier_slug: 'intact',
  claims_platform: 'Cotality/Symbility + Xactimate', secondary_platform: 'CoreLogic Workspace',
  vendor_program_name: 'Intact Rely Network',
  vendor_onboarding_url: 'https://www.intact.ca/en/personal-insurance/claims/contractors-repair-shops',
  vendor_phone: '1-855-464-6228',
  report_24hr_deadline_hours: 24, scope_deadline_days: 7, equipment_max_days: 3,
  requires_daily_logs: true, emergency_contact_deadline_minutes: 120,
  site_arrival_deadline_minutes: 240, estimate_deadline_hours: 168,
  estimate_revision_hours: 24, final_invoice_deadline_days: 7,
  requires_24hr_report: true, requires_hazmat_3stage_photos: false,
  requires_moisture_mapper_complete: false, requires_drybook: false, requires_ecoclaim_cert: false,
  export_format: 'ESX_XML', xactanalysis_integration: false,
  priority_score: 5, market_share_pct: 16.8, carrier_color: '#003DA5', is_active: true,
  notes: 'Largest Canadian P&C carrier (16.8% market share). Intact owns On Side Restoration — you must out-document their captive vendor.',
};
