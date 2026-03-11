import { CarrierProfile, CarrierSelectOption, CarrierSlug } from '@/types/carriers';
import { intactConfig }      from './intact';
import { avivaConfig }       from './aviva';
import { desjardinConfig }   from './desjardins';
import { cooperatorsConfig } from './cooperators';
import { definityConfig }    from './definity';
import { commonwellConfig }  from './commonwell';

const otherConfig: CarrierProfile = {
  id: 'other', insurer_name: 'Other Carrier', carrier_slug: 'other',
  claims_platform: 'Xactimate', export_format: 'ESX_XML',
  emergency_contact_deadline_minutes: 120, site_arrival_deadline_minutes: 240,
  estimate_deadline_hours: 168, estimate_revision_hours: 24,
  final_invoice_deadline_days: 7, report_24hr_deadline_hours: 24,
  scope_deadline_days: 7, equipment_max_days: 3,
  requires_daily_logs: false, requires_24hr_report: false,
  requires_hazmat_3stage_photos: false, requires_moisture_mapper_complete: false,
  requires_drybook: false, requires_ecoclaim_cert: false,
  priority_score: 1, carrier_color: '#64748b', is_active: true,
};

export const CARRIER_CONFIGS: Record<CarrierSlug, CarrierProfile> = {
  intact: intactConfig, aviva: avivaConfig, desjardins: desjardinConfig,
  cooperators: cooperatorsConfig, definity: definityConfig,
  commonwell: commonwellConfig, other: otherConfig,
};

export const ALL_CARRIERS: CarrierSelectOption[] = Object.values(CARRIER_CONFIGS).map(c => ({
  value: c.carrier_slug, label: c.insurer_name, color: c.carrier_color,
  marketShare: c.market_share_pct, platform: c.claims_platform,
  priorityScore: c.priority_score, isEmergency: c.emergency_contact_deadline_minutes <= 60,
})).sort((a, b) => b.priorityScore - a.priorityScore);

export const PRIORITY_CARRIERS = ALL_CARRIERS.filter(c => c.priorityScore >= 4);

export function getCarrierConfig(slug: CarrierSlug): CarrierProfile {
  return CARRIER_CONFIGS[slug] ?? CARRIER_CONFIGS['other'];
}

export { intactConfig, avivaConfig, desjardinConfig, cooperatorsConfig, definityConfig, commonwellConfig };
