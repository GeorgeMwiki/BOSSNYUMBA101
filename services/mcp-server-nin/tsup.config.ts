import { defineConfig } from 'tsup';

/**
 * tsup config for `@bossnyumba/mcp-server-nin`. Single-file bundle for
 * the Docker stage-2 image. Day-to-day builds use `tsc` via the `build`
 * script (see package.json).
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: false,
  shims: false,
  platform: 'node',
  external: ['@modelcontextprotocol/sdk'],
});
