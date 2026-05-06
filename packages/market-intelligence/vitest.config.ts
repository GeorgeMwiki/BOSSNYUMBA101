// Local vitest config so 'pnpm -C packages/market-intelligence test'
// discovers the in-package test files. Without this, vitest falls back
// to the workspace-root config whose include glob only resolves when
// cwd is the repo root — running from inside this package returns
// "No test files found". Mirrors the pattern used in
// `packages/database/vitest.config.ts`.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 15000,
  },
});
