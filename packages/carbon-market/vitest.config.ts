import { defineConfig } from 'vitest/config';

/**
 * Package-scoped vitest config. Mirrors the sibling
 * `@bossnyumba/sustainability-advisor` config — without this, the root
 * vitest config's repo-relative `include` patterns miss the per-package
 * `src/__tests__` folders when CWD is the package.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 10000,
  },
});
