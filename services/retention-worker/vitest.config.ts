import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // The enterprise-hardening package ships as prebuilt dist output and
      // does not participate in service test runs. For the worker's unit
      // tests we point the import at the actual source file so the test
      // suite does not depend on any build artifacts.
      '@bossnyumba/enterprise-hardening': path.resolve(
        here,
        '../../packages/enterprise-hardening/src/compliance/data-retention.ts',
      ),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    testTimeout: 10000,
  },
});
