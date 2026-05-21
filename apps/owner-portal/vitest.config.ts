/**
 * Vitest config for the owner-portal app.
 *
 * Scopes test discovery to `src/**` so the Vite dev/build pipeline is
 * untouched. Uses jsdom so React Testing Library can mount providers
 * (AuthContext, LocaleProvider) for the hook smoke-tests.
 *
 * Mirrors `packages/chat-ui/vitest.config.ts` so the test conventions
 * stay aligned across the monorepo.
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
