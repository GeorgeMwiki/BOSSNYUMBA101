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

        // Admin-portal specific status colors
        'health-ok': {
          50: '#ecfdf5',
          500: '#10b981',
          600: '#059669',
        },
        'health-warn': {
          50: '#fffbeb',
          500: '#f59e0b',
          600: '#d97706',
        },
        'health-critical': {
          50: '#fff1f2',
          500: '#f43f5e',
          600: '#e11d48',
        },
      },
    },
  },
};

export default config;
