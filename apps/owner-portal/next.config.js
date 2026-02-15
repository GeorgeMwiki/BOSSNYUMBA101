/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@bossnyumba/design-system', '@bossnyumba/domain-models', '@bossnyumba/authz-policy'],
};

module.exports = nextConfig;
