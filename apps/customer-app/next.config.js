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
    '@bossnyumba/observability',
    '@bossnyumba/database',
    '@bossnyumba/graph-sync',
    '@bossnyumba/enterprise-hardening',
    '@bossnyumba/api-client',
    '@bossnyumba/config',
    '@bossnyumba/compliance-plugins',
    '@bossnyumba/chat-ui',
  ],
  // Support `.js` extensions on TS source imports (NodeNext convention).
  webpack: (config, { isServer, webpack }) => {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias || {}),
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    };

    // Wave-12 CI fix: `@bossnyumba/ai-copilot` transpiles to client bundle via
    // `transpilePackages` above, and it imports `node:crypto` / `node:fs` etc.
    // for HMAC signing + audit-chain hashing. Mark these as `false` so client
    // bundle omits them; transitive crypto code becomes runtime-undefined
    // (fail-clear at use site, not at build time with UnhandledSchemeError).
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
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }],
      },
    ];
  },
};

module.exports = withNextIntl(nextConfig);
