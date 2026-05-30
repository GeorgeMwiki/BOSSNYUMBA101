import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: {
    compilerOptions: {
      skipLibCheck: true,
      verbatimModuleSyntax: false,
      exactOptionalPropertyTypes: false,
      noUncheckedIndexedAccess: false,
      lib: ['ES2022', 'DOM'],
      types: ['react', 'react-dom', 'node'],
    },
  },
  clean: true,
  splitting: false,
  sourcemap: true,
  treeshake: true,
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    'next',
    'next/dynamic',
    'next/link',
    'next/image',
    'next/navigation',
    'next/headers',
    'framer-motion',
    'lucide-react',
    '@bossnyumba/design-system',
    '@bossnyumba/api-sdk',
    '@bossnyumba/genui',
  ],
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
});
