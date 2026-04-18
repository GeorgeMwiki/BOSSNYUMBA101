import type { Config } from 'tailwindcss';
import baseConfig from '@bossnyumba/design-system/tailwind.config';

const baseExtend = (baseConfig.theme as any)?.extend ?? {};
const baseColors = baseExtend.colors ?? {};

const config: Config = {
  ...baseConfig,
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/design-system/src/**/*.{ts,tsx}',
  ],
  theme: {
    ...baseConfig.theme,
    extend: {
      ...baseExtend,
      borderRadius: {
        ...(baseExtend.borderRadius ?? {}),
        insta: '14px',
        spotify: '8px',
        chat: '20px',
        story: '9999px',
      },
      boxShadow: {
        ...(baseExtend.boxShadow ?? {}),
        spotify: '0 4px 12px rgba(0, 0, 0, 0.4)',
        'spotify-lg': '0 8px 24px rgba(0, 0, 0, 0.6)',
      },
      colors: {
        ...baseColors,
        border: 'hsl(var(--border, 0 0% 20%))',
        surface: {
          DEFAULT: 'hsl(var(--surface, 0 0% 7%))',
          card: 'hsl(var(--surface-card, 0 0% 16%))',
          elevated: 'hsl(var(--surface-elevated, 0 0% 9%))',
          hover: 'hsl(var(--surface-hover, 0 0% 20%))',
        },
        'surface-card': 'hsl(var(--surface-card, 0 0% 16%))',
        'surface-hover': 'hsl(var(--surface-hover, 0 0% 20%))',
        'spotify-green': '#1DB954',
        'spotify-green-hover': '#1ED760',
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        success: {
          50: '#f0fdf4',
          500: '#22c55e',
          600: '#16a34a',
        },
        warning: {
          50: '#fffbeb',
          500: '#f59e0b',
          600: '#d97706',
        },
        danger: {
          50: '#fef2f2',
          500: '#ef4444',
          600: '#dc2626',
        },
      },
    },
  },
};

export default config;
