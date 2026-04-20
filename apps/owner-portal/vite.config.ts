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
    port: 3000,
    proxy: {
      // Proxy only /api/ (with trailing slash) so SPA client routes
      // like /api-integrations or /api-keys don't get forwarded to the
      // gateway.
      '/api/': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4174,
    proxy: {
      '/api/': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:4001',
        changeOrigin: true,
      },
    },
  },
});
