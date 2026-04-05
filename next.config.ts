import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {
    // Silence the workspace root detection warning
    root: __dirname,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'logo.clearbit.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
};

export default nextConfig;
