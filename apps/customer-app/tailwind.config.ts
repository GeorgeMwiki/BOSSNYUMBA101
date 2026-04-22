import type { Config } from 'tailwindcss';
import baseConfig from '@bossnyumba/design-system/tailwind.config';

const baseExtend = (baseConfig.theme as any)?.extend ?? {};

/**
 * Customer-app — inherits the BossNyumba base Tailwind config and adds
 * two consumer-app-specific affordances:
 *
 *   - additional radii (story/chat/insta/spotify) used by the feed +
 *     stories surfaces
 *   - custom shadows for the content-card elevation scale
 *
 * All color tokens flow from the design-system CSS variables; no
 * hard-coded palette overrides here.
 */
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
        elevated: '0 4px 12px hsl(30 20% 10% / 0.35)',
        'elevated-lg': '0 8px 24px hsl(30 20% 10% / 0.55)',
      },
    },
  },
};

export default config;
