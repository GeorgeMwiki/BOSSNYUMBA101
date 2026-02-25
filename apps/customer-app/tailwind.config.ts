import type { Config } from 'tailwindcss';
import baseConfig from '@bossnyumba/design-system/tailwind.config';

const config: Config = {
  ...baseConfig,
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/design-system/src/**/*.{ts,tsx}',
  ],
  theme: {
    ...baseConfig.theme,
    extend: {
      ...(baseConfig.theme as { extend?: Record<string, unknown> })?.extend,
      colors: {
        ...((baseConfig.theme as { extend?: { colors?: Record<string, unknown> } })?.extend?.colors ?? {}),

        // Customer-app specific surface tokens for mobile-first dark UI
        surface: {
          DEFAULT: 'hsl(var(--surface))',
          elevated: 'hsl(var(--surface-elevated))',
          card: 'hsl(var(--surface-card))',
          hover: 'hsl(var(--surface-hover))',
        },

        // Quick access semantic colors
        'proptech-primary': '#0F172A',
        'proptech-accent': '#10B981',
        'proptech-warning': '#F59E0B',
        'proptech-error': '#F43F5E',
      },
      borderRadius: {
        ...((baseConfig.theme as { extend?: { borderRadius?: Record<string, string> } })?.extend?.borderRadius ?? {}),
        'card': '12px',
        'input': '8px',
        'chat': '18px',
        'insta': '16px',
        'story': '9999px',
      },
      boxShadow: {
        ...((baseConfig.theme as { extend?: { boxShadow?: Record<string, string> } })?.extend?.boxShadow ?? {}),
        'mobile': '0 -1px 3px 0 rgba(15, 23, 42, 0.06)',
        'mobile-card': '0 2px 8px 0 rgba(15, 23, 42, 0.06)',
      },
    },
  },
};

export default config;
