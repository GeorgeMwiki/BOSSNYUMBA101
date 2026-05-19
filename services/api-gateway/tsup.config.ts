import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  // Bundle workspace packages directly into the api-gateway artifact so
  // the runtime container does not need to traverse the pnpm symlink
  // farm to resolve `@bossnyumba/*` imports. This closes the chronic-
  // flaky E2E (`Cannot find package '@bossnyumba/database'` in the
  // production runner image) once and for all.
  //
  // node_modules outside the workspace stay external — bundling them
  // would re-introduce the node-pre-gyp / pg-native / aws-sdk dynamic-
  // require breakage. The api-gateway still ships as CJS so the
  // synchronous `require('ioredis')` IIFE at src/index.ts ~ L366 keeps
  // working; an ESM migration is a separate follow-up.
  skipNodeModulesBundle: true,
  noExternal: [/^@bossnyumba\//],
  external: [
    '@mapbox/node-pre-gyp',
    'mock-aws-s3',
    'aws-sdk',
    'nock',
    'pg-native',
    'better-sqlite3',
  ],
  loader: {
    '.html': 'empty',
  },
});
