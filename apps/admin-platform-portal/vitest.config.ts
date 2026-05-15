/**
 * Vitest config for @bossnyumba/admin-platform-portal.
 *
 * The root vitest.config restricts include to `packages/**` and
 * `services/**`, so apps need their own. We use jsdom because the
 * sensorium bus + handlers (Central Command Phase A C4) reach into
 * `document` / `window` to install DOM listeners.
 *
 * Initial scope: sensorium + lib helpers. Other surfaces (genui,
 * ag-ui-client, etc.) require optional deps that aren't always
 * installed; their tests opt in via their own include patterns once
 * a dev installs the matching package set.
 */
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, 'src') },
      // Central-Command Phase A — load AG-UI emitter + types directly
      // from `packages/central-intelligence/src` so the client hook +
      // its tests pick up the latest streaming surface without a
      // `pnpm build` round-trip. Anchor with `$` so subpath imports
      // keep resolving via the package's exports map.
      {
        find: /^@bossnyumba\/central-intelligence$/,
        replacement: path.resolve(
          __dirname,
          '../../packages/central-intelligence/src/index.ts',
        ),
      },
    ],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: [
      'src/lib/sensorium/__tests__/**/*.test.ts',
      'src/lib/sensorium/__tests__/**/*.test.tsx',
      // Central-Command Phase A — AG-UI client hook + helpers.
      'src/lib/__tests__/**/*.test.ts',
      // Central-Command Phase A — generative-UI primitive schemas (C3).
      // Schema tests run without optional UI deps installed; component
      // smoke-tests opt in once react-vega / react-leaflet / etc. land.
      'src/lib/genui/__tests__/**/*.test.ts',
    ],
    testTimeout: 10000,
  },
});
