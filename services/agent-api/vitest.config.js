import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(__dirname, '../..');

export default defineConfig({
  root: repoRoot,
  test: {
    globals: true,
    environment: 'node',
    include: ['services/agent-api/tests/**/*.spec.js', 'services/agent-api/src/**/*.test.js'],
    env: {
      NODE_ENV: 'test',
      SITEMAP_RATE_LIMIT_MS: '5', // Fast rate limiting for tests
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'services/agent-api/coverage',
      include: ['services/agent-api/src/**/*.js'],
      exclude: [
        '**/node_modules/**',
        'services/agent-api/tests/**',
        'services/agent-api/src/**/*.test.js',
        // Orchestration files - tested via integration, not unit tests
        'services/agent-api/src/cli.js',
        'services/agent-api/src/index.js',
        'services/agent-api/src/agents/discover.js',
        'services/agent-api/src/agents/enrich-item.js',
        'services/agent-api/src/routes/**',
        'services/agent-api/src/scripts/**',
      ],
    },
  },
});
