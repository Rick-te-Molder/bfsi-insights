import type { NextConfig } from 'next';
import path from 'node:path';

const TURBOPACK_ROOT = path.resolve(import.meta.dirname, '../..');

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  turbopack: {
    root: TURBOPACK_ROOT,
  },
};

export default nextConfig;
