import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://34.173.161.81:8080/api/:path*',
      },
    ];
  },
};

export default nextConfig;
