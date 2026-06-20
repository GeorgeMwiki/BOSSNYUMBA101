import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  // No .d.ts: api-gateway is a PRIVATE, deployable leaf service
  // (`node dist/index.js`) with no `types` export and zero workspace
  // consumers — the generated d.ts is never imported. Generating DTS while
  // bundling the whole workspace graph (noExternal below) is the sole OOM
  // risk under a concurrent monorepo build; typecheck is still enforced
  // separately by `tsc --noEmit`.
  dts: false,
  clean: true,
  sourcemap: true,
  // Bundle the @bossnyumba/* workspace packages INTO the api-gateway image
  // (noExternal), keeping third-party node_modules unbundled (Node resolves
  // them at runtime via pnpm symlinks). WHY: the api-gateway ships as a CJS
  // leaf service (`node dist/index.js`) and ~15 workspace packages export raw
  // `./src/index.ts` — ESM with `.js` specifiers that resolve to uncompiled
  // `.ts` (e.g. brain-llm-router/dynamic-registry → `./baselines.js`). Plain
  // Node cannot `require()`/resolve those: production + E2E boot crashed with
  // ERR_MODULE_NOT_FOUND on the first such import. Inlining the workspace
  // graph at build time removes that whole resolution class — esbuild walks
  // the real `.ts` sources and emits one self-contained bundle. (Ported from
  // the live Borjie sibling, which runs this exact strategy in production.)
  skipNodeModulesBundle: true,
  // jose@6 (hono-auth JWT) and uuid (observability audit-logger) are pure ESM
  // — no `require`/`node` export condition — so left external in a CJS bundle
  // they boot-crash with ERR_REQUIRE_ESM. Inline them so esbuild transpiles
  // the ESM source into the CJS bundle. Keep in sync with the ESM-only probe.
  noExternal: [/^@bossnyumba\//, 'jose', 'uuid'],
  // Native/optional deps esbuild cannot safely walk — keep external.
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
