import type { Config } from 'tailwindcss';
import baseConfig from '@bossnyumba/design-system/tailwind.config';

const config: Config = {
  ...baseConfig,
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/design-system/src/**/*.{ts,tsx}',
  ],
};

export default config;
