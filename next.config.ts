import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '*.mega.co.nz',
      },
      {
        protocol: 'https',
        hostname: '*.mega.nz',
      },
    ],
    // Optimize image output quality
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000,
  },
  // Compress all responses
  compress: true,
  // Aggressive HTTP caching headers for Cloudflare CDN
  async headers() {
    return [
      {
        // Cache static JS/CSS/fonts aggressively on Cloudflare edge
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'CDN-Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'Cloudflare-CDN-Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // Cache media stream responses on Cloudflare edge for 1 year
        source: '/api/mega/stream',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'CDN-Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'Vary', value: 'Accept-Encoding, Range' },
          // Allow Cloudflare to cache range request responses
          { key: 'CF-Cache-Status', value: 'HIT' },
        ],
      },
    ];
  },
};

export default nextConfig;

