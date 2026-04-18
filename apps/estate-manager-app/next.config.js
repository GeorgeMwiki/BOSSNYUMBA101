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
  ],
  // Support `.js` extensions on TS source imports (NodeNext convention).
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias || {}),
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    };
    return config;
  },
};

module.exports = nextConfig;
