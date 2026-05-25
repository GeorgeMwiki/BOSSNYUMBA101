/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Support `.js` extensions on TS source imports (NodeNext convention)
  // — matches the rest of the BOSSNYUMBA monorepo.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias || {}),
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    };
    return config;
  },
};

module.exports = nextConfig;
