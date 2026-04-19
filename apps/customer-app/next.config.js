const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: [
    '@bossnyumba/design-system',
    '@bossnyumba/domain-models',
    '@bossnyumba/authz-policy',
    '@bossnyumba/ai-copilot',
    '@bossnyumba/observability',
    '@bossnyumba/database',
    '@bossnyumba/graph-sync',
    '@bossnyumba/enterprise-hardening',
    '@bossnyumba/api-client',
    '@bossnyumba/config',
    '@bossnyumba/compliance-plugins',
  ],
  // Support `.js` extensions on TS source imports (NodeNext convention).
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias || {}),
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    };
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
