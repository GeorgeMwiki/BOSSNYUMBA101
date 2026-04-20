import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3001,
    proxy: {
      // Proxy only /api/ (with trailing slash) — otherwise Vite's string
      // prefix match catches SPA routes like /api-integrations and
      // forwards them to the backend, which returns 500 because there's
      // no such route. The slash forces Vite to only match the gateway
      // path prefix.
      '/api/': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api/': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:4001',
        changeOrigin: true,
      },
    },
  },
});
