import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@bossnyumba/domain-models': path.resolve(
        __dirname,
        '../../packages/domain-models/src/index.ts'
      ),
      // Test-only shim: the real @bossnyumba/database package source
      // has duplicate schema exports that break esbuild transform. During
      // vitest runs, routes should use in-memory mock data anyway
      // (NODE_ENV === 'test'), so we substitute a minimal stub that
      // resolves all named imports used across the service.
      '@bossnyumba/database': path.resolve(
        __dirname,
        './src/adapters/database-test-shim.ts'
      ),
      '@bossnyumba/authz-policy': path.resolve(
        __dirname,
        '../../packages/authz-policy/src/index.ts'
      ),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    pool: 'forks',
    server: {
      deps: {
        inline: ['@hono/node-server'],
      },
    },
    testTimeout: 10000,
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-key-for-integration-tests-only-do-not-use-in-production',
    },
  },
});
