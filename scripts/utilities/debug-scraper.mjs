#!/usr/bin/env node
import { chromium } from 'playwright';

const url = process.argv[2] || 'https://www.ecb.europa.eu/press/key/html/index.en.html';

async function debug() {
  console.log(`🔍 Inspecting: ${url}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  console.log(`📄 Page title: ${await page.title()}\n`);

  // Get first 5 items
  const items = await page.$$eval('div[class*="item"]', (elements) => {
    return elements.slice(0, 5).map((el) => ({
      classes: el.className,
      text: el.textContent?.trim().substring(0, 150),
      links: Array.from(el.querySelectorAll('a')).map((a) => ({
        text: a.textContent?.trim().substring(0, 80),
        href: a.href,
      })),
    }));
  });

  items.forEach((item, i) => {
    console.log(`\n📌 Item ${i + 1}:`);
    console.log(`   Classes: ${item.classes}`);
    console.log(`   Text: ${item.text}`);
    console.log(`   Links (${item.links.length}):`);
    item.links.forEach((link) => {
      if (link.href && !link.href.includes('#')) {
        console.log(`     - ${link.text} -> ${link.href}`);
      }
    });
  });

  await browser.close();
}

debug();
