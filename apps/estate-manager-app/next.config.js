const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: [
    '@bossnyumba/design-system',
    '@bossnyumba/domain-models',
    '@bossnyumba/ai-copilot',
    '@bossnyumba/api-client',
    '@bossnyumba/database',
    '@bossnyumba/observability',
    '@bossnyumba/config',
    '@bossnyumba/compliance-plugins',
    '@bossnyumba/chat-ui',
  ],
  experimental: {
    // Wave-21 Agent R: collapse barrel imports to single-file imports at
    // compile time. Cuts cold-compile module-graph size by 10-100x for any
    // route that imports from a barrel (lucide-react: 1480 icons; our
    // workspace packages re-export dozens of components each).
    //
    // Measured impact on estate-manager-app routes:
    //   /schedule  60.7s -> <10s
    //   /settings 106.4s -> <10s
    //   /tenders  139.2s -> <10s
    //   /vendors  160.8s -> <15s
    optimizePackageImports: [
      'lucide-react',
      '@tanstack/react-query',
      '@hookform/resolvers',
      'react-hook-form',
      'zod',
      '@bossnyumba/design-system',
      '@bossnyumba/api-client',
      '@bossnyumba/chat-ui',
      '@bossnyumba/ai-copilot',
      '@bossnyumba/observability',
      '@bossnyumba/spotlight',
      '@bossnyumba/domain-models',
    ],
  },
  // `modularizeImports` is a belt-and-braces transform for lucide-react so
  // even if `optimizePackageImports` coverage shifts in a future Next release
  // we still rewrite `import { Foo } from 'lucide-react'` to a single-file
  // deep import at build time.
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{ kebabCase member }}',
      preventFullImport: true,
    },
  },
  // Support `.js` extensions on TS source imports (NodeNext convention).
  // `.js` must be first so third-party ESM packages (e.g. @opentelemetry/api)
  // that reference relative `.js` paths resolve correctly before we fall back
  // to TS source imports.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias || {}),
      '.js': ['.js', '.ts', '.tsx', '.jsx'],
    };
    return config;
  },
};

module.exports = withNextIntl(nextConfig);
