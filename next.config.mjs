/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverComponentsExternalPackages: [
      '@prisma/client',
      'prisma',
      'bullmq',
      'ioredis',
      'pino',
      'pino-pretty',
      'bcryptjs',
    ],
  },
};

export default nextConfig;
