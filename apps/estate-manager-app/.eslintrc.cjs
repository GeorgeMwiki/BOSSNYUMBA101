/**
 * ESLint config for @bossnyumba/estate-manager-app (Next.js 14).
 *
 * Extends Next's recommended config plus `plugin:jsx-a11y/recommended` as the
 * authoring-time companion to the @axe-core/playwright runtime scans in
 * e2e/a11y. CI runs `pnpm lint` (→ `next lint`) and will fail on any jsx-a11y
 * violation. Do NOT add disable comments without a linked accessibility ticket.
 */
module.exports = {
  root: true,
  extends: [
    'next/core-web-vitals',
    'plugin:jsx-a11y/recommended',
  ],
  plugins: ['jsx-a11y'],
  settings: {
    react: { version: 'detect' },
  },
  ignorePatterns: ['.next', 'node_modules', 'next-env.d.ts'],
};
