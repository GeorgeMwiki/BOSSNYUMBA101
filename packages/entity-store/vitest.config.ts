/**
 * Local vitest config for @bossnyumba/entity-store.
 *
 * Mirrors packages/database/vitest.config.ts so `pnpm -C packages/entity-store
 * test` discovers in-package test files. Workspace-root vitest config only
 * resolves include globs when cwd is the repo root.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 15000,
  },
});
