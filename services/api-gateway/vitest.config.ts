import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@bossnyumba/domain-models': path.resolve(
        __dirname,
        '../../packages/domain-models/src/index.ts'
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
  },
});
