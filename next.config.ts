import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  images: {
    remotePatterns: [
      // Unsplash (used for mock/demo cover images)
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      // MEGA CDN thumbnails (if megajs ever exposes them)
      {
        protocol: 'https',
        hostname: '*.mega.co.nz',
      },
      {
        protocol: 'https',
        hostname: '*.mega.nz',
      },
    ],
  },
};

export default nextConfig;
