import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@bossnyumba/domain-models': path.resolve(
        __dirname,
        '../../packages/domain-models/src/index.ts'
      ),
      '@bossnyumba/payments-ledger-service/arrears': path.resolve(
        __dirname,
        '../payments-ledger/src/arrears/index.ts'
      ),
      '@bossnyumba/ai-copilot/services/migration/parsers/parse-upload': path.resolve(
        __dirname,
        '../../packages/ai-copilot/src/services/migration/parsers/parse-upload.ts'
      ),
      '@bossnyumba/domain-services/gamification': path.resolve(
        __dirname,
        '../domain-services/src/gamification/index.ts'
      ),
      '@bossnyumba/payments/providers/gepg': path.resolve(
        __dirname,
        '../payments/src/providers/gepg/index.ts'
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
