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
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  treeshake: true,
});
