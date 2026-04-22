import type { Config } from 'tailwindcss';
import baseConfig from '@bossnyumba/design-system/tailwind.config';

/**
 * Estate-manager-app — inherits the BossNyumba base Tailwind config.
 * No local color overrides; all palette comes from design-system CSS
 * variables in globals.css (loaded by apps/estate-manager-app/
 * src/app/globals.css via @import of the design-system stylesheet).
 */
const config: Config = {
  ...baseConfig,
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/design-system/src/**/*.{ts,tsx}',
  ],
};

export default config;
