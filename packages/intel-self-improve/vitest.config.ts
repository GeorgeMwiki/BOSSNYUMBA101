import { defineConfig } from 'vitest/config';

/**
 * Package-scoped vitest config for @bossnyumba/intel-self-improve.
 *
 * Mirrors sibling intel packages (@bossnyumba/forecasting,
 * @bossnyumba/knowledge-graph, etc.) — tests live in src/__tests__/*.test.ts
 * and consume deterministic fixtures from src/__fixtures__/.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 10000,
  },
});
