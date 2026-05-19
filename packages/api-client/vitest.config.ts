import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // AM-1 scrubber + client tests touch window.localStorage / fetch /
    // document.cookie — they need jsdom. Pre-AM-1 the suite was
    // node-only because nothing here exercised the DOM; flipping to
    // jsdom is required for the new coverage.
    environment: 'jsdom',
  },
});
