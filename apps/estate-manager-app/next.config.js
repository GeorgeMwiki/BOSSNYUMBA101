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
    '@bossnyumba/api-client',
    '@bossnyumba/database',
    '@bossnyumba/observability',
    '@bossnyumba/config',
    '@bossnyumba/compliance-plugins',
    '@bossnyumba/chat-ui',
  ],
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
