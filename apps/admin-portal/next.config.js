/**
 * NOTE: This file is a leftover from when admin-portal was a Next.js app.
 * The admin-portal is now a Vite SPA (see vite.config.ts).
 * This file is NOT used by Vite and can be safely deleted.
 */
// @ts-nocheck
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@bossnyumba/design-system', '@bossnyumba/domain-models', '@bossnyumba/authz-policy'],
};

module.exports = nextConfig;
