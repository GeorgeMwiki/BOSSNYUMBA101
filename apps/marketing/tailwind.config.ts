import type { Config } from 'tailwindcss';
import baseConfig from '@bossnyumba/design-system/tailwind.config';

const config: Config = {
  ...baseConfig,
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/design-system/src/**/*.{ts,tsx}',
    // chat-ui ships as compiled JS in dist/. Tailwind must scan it so
    // the LitFinWidget FAB classes (fixed bottom-6 right-6 z-50, h-14,
    // w-14, bg-gradient-to-br, etc.) survive into the generated CSS.
    // Without this, the floating chat bubble renders as a static-flow
    // 0-px <button> at the bottom of the page (the user's "missing
    // widget" report). Including the JS dist alongside the .tsx source
    // covers both dev (next/dynamic pulls dist/) and watch rebuilds.
    '../../packages/chat-ui/dist/**/*.{js,mjs}',
    '../../packages/chat-ui/src/**/*.{ts,tsx}',
  ],
};

export default config;
