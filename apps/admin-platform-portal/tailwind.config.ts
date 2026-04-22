import type { Config } from 'tailwindcss';
import baseConfig from '@bossnyumba/design-system/tailwind.config';

/**
 * admin-platform-portal — HQ-internal surface. Inherits the BossNyumba
 * base Tailwind config; no local color overrides. All palette flows
 * from the design-system CSS variables loaded via globals.css.
 */
const config: Config = {
  ...baseConfig,
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/design-system/src/**/*.{ts,tsx}',
  ],
};

export default config;
