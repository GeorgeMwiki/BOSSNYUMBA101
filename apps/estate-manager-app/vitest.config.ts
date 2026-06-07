import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Mirror the tsconfig `@/*` → `./src/*` mapping so tests can import
      // (and mock) app modules by their app-absolute specifier.
      '@': resolve(process.cwd(), 'src'),
    },
  },
  test: {
    globals: true,
    // jsdom for component tests; the pre-existing pure-node lib tests run
    // fine under jsdom too (they only touch a localStorage shim).
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
