import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'apps/web/e2e',
  outputDir: 'artifacts/test/playwright',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { outputFolder: 'artifacts/test/playwright-report' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4321',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    port: 4321,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
