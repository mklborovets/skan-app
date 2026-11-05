export const theme = {
  colors: {
    background: '#090D16',
    surface: '#111827',
    surfaceElevated: '#1F2937',
    surfaceOverlay: 'rgba(9, 13, 22, 0.78)',
    border: '#334155',
    borderSubtle: '#1E293B',
    primary: '#3B82F6',
    primaryPressed: '#2563EB',
    primaryMuted: 'rgba(59, 130, 246, 0.18)',
    accent: '#10B981',
    accentMuted: 'rgba(16, 185, 129, 0.2)',
    warning: '#F59E0B',
    danger: '#EF4444',
    dangerMuted: 'rgba(239, 68, 68, 0.16)',
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    textInverse: '#090D16',
    quadStroke: '#10B981',
    quadFill: 'rgba(16, 185, 129, 0.18)',
    quadUnstableStroke: '#3B82F6',
    quadUnstableFill: 'rgba(59, 130, 246, 0.14)',
  },
  spacing: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  radii: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 20,
    full: 9999,
  },
  typography: {
    h1: {
      fontSize: 26,
      lineHeight: 32,
      fontWeight: '700' as const,
    },
    h2: {
      fontSize: 20,
      lineHeight: 26,
      fontWeight: '700' as const,
    },
    h3: {
      fontSize: 17,
      lineHeight: 22,
      fontWeight: '600' as const,
    },
    body: {
      fontSize: 15,
      lineHeight: 21,
      fontWeight: '400' as const,
    },
    bodyStrong: {
      fontSize: 15,
      lineHeight: 21,
      fontWeight: '600' as const,
    },
    caption: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '500' as const,
    },
    mono: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '600' as const,
    },
  },
} as const;

export type AppTheme = typeof theme;
export type ThemeColorKey = keyof typeof theme.colors;
export type TypographyVariant = keyof typeof theme.typography;
