// RoomLensPro Brand Design System
export const Colors = {
  // Brand
  navy:       '#0a1628',
  navyLight:  '#1e3a5f',
  red:        '#e63946',
  redDark:    '#c1121f',
  gold:       '#f4a261',

  // UI
  background: '#f0f4f8',
  card:       '#ffffff',
  border:     '#e2e8f0',
  inputBg:    '#f8f9fc',

  // Text
  textPrimary:   '#0a1628',
  textSecondary: '#64748b',
  textMuted:     '#94a3b8',
  textInverse:   '#ffffff',

  // Status
  success: '#22c55e',
  warning: '#f59e0b',
  error:   '#e63946',
  info:    '#3b82f6',

  // Job status badges
  statusActive:   '#22c55e',
  statusPending:  '#f59e0b',
  statusComplete: '#3b82f6',
  statusDraft:    '#94a3b8',

  // Moisture readings (IICRC S500)
  moistureGreen:  '#22c55e',
  moistureYellow: '#f59e0b',
  moistureRed:    '#e63946',

  // Module tiles
  tileFloorplan: '#3b82f6',
  tileMoisture:  '#06b6d4',
  tilePhotos:    '#8b5cf6',
  tileEstimate:  '#f59e0b',
} as const;

export const Spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
} as const;

export const Radius = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  28,
  full: 999,
} as const;

export const FontSize = {
  xs:   11,
  sm:   13,
  md:   15,
  lg:   17,
  xl:   20,
  xxl:  24,
  xxxl: 28,
  hero: 32,
} as const;

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
} as const;
