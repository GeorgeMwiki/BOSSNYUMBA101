import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'tenant/index': 'src/tenant/index.ts',
    'property/index': 'src/property/index.ts',
    'lease/index': 'src/lease/index.ts',
    'payment/index': 'src/payment/index.ts',
    'maintenance/index': 'src/maintenance/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: {
    // Only emit declarations for the primary entry to keep the dts build
    // stable across overlapping subpath entries. Consumers should import
    // named exports from the root entry.
    entry: { index: 'src/index.ts' },
    resolve: true,
    compilerOptions: {
      strict: false,
      noImplicitAny: false,
      strictNullChecks: false,
      exactOptionalPropertyTypes: false,
      noUncheckedIndexedAccess: false,
    },
  },
  clean: true,
  splitting: false,
  sourcemap: true,
  treeshake: true,
});
