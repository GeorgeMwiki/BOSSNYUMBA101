import { defineConfig } from 'vitest/config';

/**
 * Package-scoped vitest config. Without this, `pnpm -F test` inherits the
 * root config whose include patterns are repo-relative and miss the
 * per-package `src/__tests__` folder.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 10_000,
  },
});
