import { defineConfig } from 'vitest/config';

/**
 * Customer-app vitest config.
 *
 * Scoped to the app's own src tree so unit tests adjacent to sources (e.g.
 * `src/contexts/auth-utils.test.ts`) are discovered when running
 * `pnpm --filter @bossnyumba/customer-app test`.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['**/node_modules/**', '**/.next/**', '**/dist/**'],
    testTimeout: 10000,
  },
});
