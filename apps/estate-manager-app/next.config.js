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
    '@bossnyumba/performance-toolkit',
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
  webpack: (config, { isServer, webpack }) => {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias || {}),
      '.js': ['.js', '.ts', '.tsx', '.jsx'],
    };

    // Wave-12 CI fix: `@bossnyumba/ai-copilot` and `@bossnyumba/central-intelligence`
    // import `node:crypto`, `node:fs/promises`, etc. for HMAC signing, audit-chain
    // hashing, and Ed25519 tool-registry signatures. These modules MUST only run
    // server-side. On the client bundle:
    //   1. `resolve.fallback: { crypto: false, ... }` covers bare imports like
    //      `import crypto from 'crypto'` (webpack 5 standard pattern).
    //   2. `IgnorePlugin` with the `node:` scheme regex strips the scheme-style
    //      imports (`import crypto from 'node:crypto'`) which webpack 5's
    //      `UnhandledSchemeError` would otherwise raise at build time.
    // Any client component that transitively imports server-only crypto code
    // will fail with a clear runtime error (not a confusing build-time error).
    if (!isServer) {
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        crypto: false,
        fs: false,
        'fs/promises': false,
        path: false,
        stream: false,
        os: false,
        util: false,
        net: false,
        tls: false,
        zlib: false,
      };

      config.plugins = config.plugins || [];
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^node:(crypto|fs|fs\/promises|path|stream|os|util|net|tls|zlib|events|buffer)$/,
        }),
      );
    }

    return config;
  },
};

module.exports = withNextIntl(nextConfig);
