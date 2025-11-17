#!/usr/bin/env node

import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const THUMBS_DIR = path.join(__dirname, '../public/thumbs');

const resources = [
  {
    filename: '2025_the-future-of-ai-in-the-insurance-industry_milinkovich-mckinsey.png',
    url: 'https://www.mckinsey.com/industries/financial-services/our-insights/the-future-of-ai-in-the-insurance-industry',
    title: 'The future of AI in the insurance industry',
  },
  {
    filename: '2025_why-do-multi-agent-llm-systems-fail_cemri-arxiv.png',
    url: 'https://arxiv.org/abs/2503.13657',
    title: 'Why Do Multi-Agent LLM Systems Fail?',
  },
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1200, height: 675 } });

for (const resource of resources) {
  console.log(`📸 ${resource.title}...`);
  const page = await context.newPage();

  try {
    await page.goto(resource.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);

    await page.addStyleTag({
      content: `[class*="cookie"],[id*="cookie"],[class*="consent"]{display:none!important}`,
    });

    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(THUMBS_DIR, resource.filename), type: 'png' });
    console.log(`   ✅ ${resource.filename}\n`);
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
  } finally {
    await page.close();
  }
}

await browser.close();
console.log('✨ Done!');
