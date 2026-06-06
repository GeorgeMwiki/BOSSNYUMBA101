import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Mirror the tsconfig `@/*` → `./src/*` path mapping so tests can
      // import (and mock) app modules by their app-absolute specifier.
      // `process.cwd()` is the package root when vitest runs, and this
      // avoids `import.meta` (disallowed under the app's CJS tsconfig).
      '@': resolve(process.cwd(), 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
