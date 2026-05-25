import type { Config } from 'tailwindcss';

/**
 * tenant-portal Tailwind — mobile-first, slim.
 *
 * Mirrors the customer-app color tokens (which inherit from
 * @bossnyumba/design-system) by referencing the same CSS variables in
 * the surface styles. We don't pull in the full design-system here to
 * keep the build graph minimal — this is the chat-first front door,
 * not the full PWA.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Aliases for the brand palette used in the customer-app. The
        // hex values mirror `--brand-*` from
        // `packages/design-system/src/tokens.css` and are duplicated
        // here on purpose so the design-system isn't a build-graph
        // dependency.
        brand: {
          DEFAULT: '#2563eb',
          dark: '#1e3a8a',
          light: '#dbeafe',
        },
        ink: {
          DEFAULT: '#111827',
          muted: '#6b7280',
        },
        surface: {
          DEFAULT: '#ffffff',
          subtle: '#f9fafb',
          raised: '#f3f4f6',
        },
      },
      borderRadius: {
        chat: '20px',
        chip: '9999px',
      },
      boxShadow: {
        chip: '0 1px 2px rgba(0,0,0,0.05)',
        panel: '0 6px 24px rgba(15,23,42,0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
