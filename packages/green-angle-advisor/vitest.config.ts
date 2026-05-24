import { defineConfig } from 'vitest/config';

/**
 * Package-scoped vitest config — mirrors @bossnyumba/scientific-discovery.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 10000,
  },
});
