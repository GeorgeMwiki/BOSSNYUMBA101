import { defineConfig } from 'vitest/config';

/**
 * Phase J8 — streaming-client vitest config.
 *
 * The package is isomorphic (transports + state reducer are spec-mockable),
 * but several modules (`OfflineCache`, `ServiceWorkerRegistrar`,
 * `MobileNetworkPolicy`) require DOM-shaped globals. We use jsdom + the
 * `fake-indexeddb` shim to keep tests headless + deterministic.
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/__tests__/**'],
    },
  },
});
