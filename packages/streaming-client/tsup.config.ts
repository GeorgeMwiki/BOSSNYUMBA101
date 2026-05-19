import { defineConfig } from 'tsup';

/**
 * Phase J8 — streaming-client (narrowed scope).
 *
 * Single entry: `src/index.ts` — SSE transport, optimistic reducer,
 * offline cache (idb-keyval), and network policy. Service-worker push,
 * WebSocket transport, and the mobile bench were deferred to follow-up
 * PRs to keep this change focused and reviewable.
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: {
    compilerOptions: {
      skipLibCheck: true,
      verbatimModuleSyntax: false,
      exactOptionalPropertyTypes: false,
      noUncheckedIndexedAccess: false,
      lib: ['ES2023', 'DOM'],
      types: ['node'],
    },
  },
  clean: true,
  splitting: false,
  sourcemap: true,
  treeshake: true,
});
