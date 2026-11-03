/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  experimental: {
    serverComponentsExternalPackages: ['bullmq', 'ioredis', 'pino', 'pino-pretty'],
  },
};

export default nextConfig;
