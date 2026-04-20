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
      //
      // Port 4001 matches every other app's dev proxy + the gateway's
      // default PORT. The legacy 4000 default here meant owner-portal
      // saw ECONNREFUSED on every API call in dev — Agent J caught it
      // in Wave 19.
      '/api/': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:4001',
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
