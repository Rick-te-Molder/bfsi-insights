import type { NextConfig } from 'next';

const isVercelBuild = process.env.VERCEL === '1';

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: !isVercelBuild,
};

export default nextConfig;
