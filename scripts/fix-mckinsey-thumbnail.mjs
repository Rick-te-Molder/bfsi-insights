#!/usr/bin/env node

import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const THUMBS_DIR = path.join(__dirname, '../public/thumbs');

const browser = await chromium.launch({ headless: false }); // Use headed mode
const context = await browser.newContext({
  viewport: { width: 1200, height: 675 },
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
});

const page = await context.newPage();

try {
  console.log('📸 Loading McKinsey page...');
  await page.goto(
    'https://www.mckinsey.com/industries/financial-services/our-insights/the-future-of-ai-in-the-insurance-industry',
    {
      waitUntil: 'networkidle',
      timeout: 30000,
    },
  );

  await page.waitForTimeout(3000);

  await page.addStyleTag({
    content: `[class*="cookie"],[id*="cookie"],[class*="consent"]{display:none!important}`,
  });

  await page.waitForTimeout(1000);

  await page.screenshot({
    path: path.join(
      THUMBS_DIR,
      '2025_the-future-of-ai-in-the-insurance-industry_milinkovich-mckinsey.png',
    ),
    type: 'png',
  });

  console.log('✅ Generated thumbnail!');
} catch (error) {
  console.log(`❌ Error: ${error.message}`);
} finally {
  await browser.close();
}
