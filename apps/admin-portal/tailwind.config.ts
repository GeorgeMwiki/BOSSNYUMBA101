/**
 * apps/admin-portal — minimal Tailwind config.
 *
 * The portal is deprecated; only the "moved" landing renders. We don't
 * need the design-system tailwind extensions here — stock Tailwind is
 * enough to style the landing page.
 */
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};

export default config;
