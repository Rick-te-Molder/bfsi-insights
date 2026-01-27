import type { NextConfig } from 'next';

const isVercelBuild = process.env.VERCEL === '1';

const nextConfig: NextConfig = {
  reactCompiler: !isVercelBuild,
  typescript: {
    // Type checking is done by ESLint and CI, skip during build to avoid
    // Vercel hanging on "Running TypeScript ..." step
    ignoreBuildErrors: isVercelBuild,
  },
};

export default nextConfig;
