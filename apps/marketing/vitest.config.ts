/**
 * Vitest config for the marketing app.
 *
 * Scopes test discovery to `src/**` so the Next.js dev/build pipeline is
 * untouched. Uses jsdom so React Testing Library can mount the
 * locale-aware auth pages and assert the real form components are wired
 * in (not the legacy dead raw <form action> blocks).
 *
 * Mirrors `apps/owner-portal/vitest.config.ts` so test conventions stay
 * aligned across the monorepo.
 */

import path from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
