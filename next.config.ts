import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@napi-rs/canvas', 'pdfjs-dist'],
};

export default nextConfig;
