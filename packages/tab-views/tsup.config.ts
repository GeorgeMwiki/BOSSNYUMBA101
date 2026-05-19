import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'types/index': 'src/types/index.ts',
    'registry/index': 'src/registry/index.ts',
    'render-tool/index': 'src/render-tool/index.ts',
    'interactivity/index': 'src/interactivity/index.ts',
    'customization/index': 'src/customization/index.ts',
    'views/index': 'src/views/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: {
    compilerOptions: {
      skipLibCheck: true,
      verbatimModuleSyntax: false,
      exactOptionalPropertyTypes: true,
      noUncheckedIndexedAccess: true,
      lib: ['ES2022'],
      types: ['node'],
    },
  },
  clean: true,
  splitting: false,
  sourcemap: true,
  treeshake: true,
});
