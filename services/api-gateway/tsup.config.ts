import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  // Keep node_modules + workspace packages unbundled. Node resolves them
  // at runtime via pnpm symlinks. Avoids esbuild choking on subpath
  // exports and dynamic requires in transitive deps (node-pre-gyp etc).
  skipNodeModulesBundle: true,
  external: [
    /^@bossnyumba\//,
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
