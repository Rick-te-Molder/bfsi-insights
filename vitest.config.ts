import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  root: __dirname,
  resolve: {
    alias: {
      '@': resolve(__dirname, 'apps/admin/src'),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: [
      'apps/web/tests/**/*.spec.ts',
      'apps/admin/tests/**/*.spec.ts',
      'apps/admin/tests/**/*.spec.tsx',
      'scripts/tests/**/*.spec.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: resolve(__dirname, 'artifacts/test/coverage'),
      include: [
        'apps/web/**/*.ts',
        'apps/admin/src/components/ui/**/*.ts',
        'apps/admin/src/components/ui/**/*.tsx',
        'apps/admin/src/components/tags/**/*.ts',
        'apps/admin/src/components/dashboard/**/*.ts',
        'apps/admin/src/components/dashboard/**/*.tsx',
      ],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.spec.ts',
        '**/*.spec.tsx',
        '**/*.test.ts',
        '**/*.test.js',
        '**/scripts/**',
        '**/cli.js',
        '**/*.config.{js,ts}',
      ],
    },
  },
});
