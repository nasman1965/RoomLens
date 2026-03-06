// IICRC S500 moisture thresholds by material type
export const MOISTURE_THRESHOLDS = {
  wood:      { green: 16,  yellow: 19 },   // MC%: <16 dry, 16-19 caution, >19 wet
  drywall:   { green: 1,   yellow: 2  },
  concrete:  { green: 4,   yellow: 7  },
  subfloor:  { green: 16,  yellow: 19 },
  ceiling:   { green: 1,   yellow: 2  },
} as const;

export type MaterialType = keyof typeof MOISTURE_THRESHOLDS;

export const MATERIAL_LABELS: Record<MaterialType, string> = {
  wood:     'Wood / Hardwood',
  drywall:  'Drywall / Gypsum',
  concrete: 'Concrete / Masonry',
  subfloor: 'Subfloor / OSB',
  ceiling:  'Ceiling / Plaster',
};

export const getMoistureStatus = (
  mc: number,
  material: MaterialType
): 'green' | 'yellow' | 'red' => {
  const t = MOISTURE_THRESHOLDS[material];
  if (mc < t.green)  return 'green';
  if (mc < t.yellow) return 'yellow';
  return 'red';
};

// Common room name suggestions for autocomplete
export const ROOM_SUGGESTIONS = [
  'Living Room', 'Kitchen', 'Master Bedroom', 'Bedroom 2', 'Bedroom 3',
  'Master Bathroom', 'Bathroom', 'Half Bath', 'Hallway', 'Dining Room',
  'Family Room', 'Laundry Room', 'Garage', 'Basement', 'Office',
  'Utility Room', 'Mudroom', 'Entryway', 'Attic', 'Stairwell',
];

// Job types
export const JOB_TYPES = [
  { value: 'water_loss',   label: 'Water Loss',   icon: 'water-outline' },
  { value: 'fire_loss',    label: 'Fire Loss',    icon: 'flame-outline' },
  { value: 'mold',         label: 'Mold',         icon: 'leaf-outline' },
  { value: 'large_loss',   label: 'Large Loss',   icon: 'business-outline' },
  { value: 'other',        label: 'Other',        icon: 'construct-outline' },
] as const;

export type JobType = typeof JOB_TYPES[number]['value'];

// Camera OSC endpoints
export const CAMERA_ENDPOINTS = {
  insta360: {
    ip: '192.168.42.1',
    port: 80,
    baseUrl: 'http://192.168.42.1',
  },
  theta: {
    ip: '192.168.1.1',
    port: 80,
    baseUrl: 'http://192.168.1.1',
  },
} as const;

export type CameraType = 'insta360' | 'theta' | 'manual';

// BLE device name filters for moisture meters
export const BLE_METER_NAMES = [
  'Tramex', 'TRAMEX', 'ME5', 'MEX5', 'CMEX5',
  'Protimeter', 'PROTIMETER', 'MMS3', 'MMS',
  'Delmhorst', 'DELMHORST',
];

// Subscription tiers
export const SUBSCRIPTION_TIERS = {
  free:       { label: 'Free',       jobsPerMonth: 3,  allModules: false },
  starter:    { label: 'Starter',    jobsPerMonth: 20, allModules: true  },
  pro:        { label: 'Pro',        jobsPerMonth: -1, allModules: true  },
  enterprise: { label: 'Enterprise', jobsPerMonth: -1, allModules: true  },
} as const;
