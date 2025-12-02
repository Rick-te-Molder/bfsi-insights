import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.spec.js'],
    env: {
      NODE_ENV: 'test',
      SITEMAP_RATE_LIMIT_MS: '5', // Fast rate limiting for tests
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
    },
  },
});
