export const tokens = {
  color: {
    bg: '#060817',
    bgSurface: '#0b1024',
    text: '#eef6ff',
    textMuted: '#9fb1c7',
    accent: '#38bdf8',
    accentContrast: '#00111d',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    border: 'rgba(255,255,255,0.16)',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { sm: 8, md: 12, lg: 16, pill: 999 },
  typography: {
    fontFamily: 'System',
    fontFamilyMono: 'monospace',
    size: { sm: 12, md: 14, lg: 16, xl: 20, hero: 28 },
    weight: { regular: '400' as const, medium: '500' as const, bold: '700' as const },
  },
  motion: { fast: 150, normal: 250, slow: 400 },
};

export type ThemeTokens = typeof tokens;
