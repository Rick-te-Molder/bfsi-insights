#!/usr/bin/env node

import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const THUMBS_DIR = path.join(__dirname, '../public/thumbs');

// Ensure thumbs directory exists
if (!fs.existsSync(THUMBS_DIR)) {
  fs.mkdirSync(THUMBS_DIR, { recursive: true });
}

async function main() {
  console.log('🖼️  Starting thumbnail generation...');

  // Get resources that need thumbnails
  const resources = await getResourcesNeedingThumbnails();

  if (resources.length === 0) {
    console.log('✅ All resources already have thumbnails!');
    return;
  }

  console.log(`📋 Found ${resources.length} resources needing thumbnails:`);
  resources.forEach((r, i) => {
    console.log(`   ${i + 1}. ${r.title}`);
  });
  console.log('');

  // Launch browser
  console.log('🚀 Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1200, height: 675 }, // 16:9 aspect ratio
    deviceScaleFactor: 1,
  });

  const results = [];

  // Process each resource
  for (let i = 0; i < resources.length; i++) {
    const resource = resources[i];
    console.log(`[${i + 1}/${resources.length}] Processing: ${resource.title}`);
    console.log(`   URL: ${resource.url}`);

    try {
      const success = await generateThumbnail(context, resource);
      results.push({ resource, success });

      if (success) {
        console.log('   ✅ Thumbnail generated successfully');
      } else {
        console.log('   ❌ Failed to generate thumbnail');
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      results.push({ resource, success: false, error: error.message });
    }

    // Small delay between requests
    if (i < resources.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  await browser.close();

  // Report results
  console.log('\n' + '='.repeat(70));
  console.log('📊 THUMBNAIL GENERATION REPORT');
  console.log('='.repeat(70));

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);

  if (failed > 0) {
    console.log('\nFailed resources:');
    results
      .filter((r) => !r.success)
      .forEach(({ resource, error }) => {
        console.log(`• ${resource.title} (${error || 'Unknown error'})`);
      });
  }

  console.log('\n✨ Done!');
}

async function generateThumbnail(context, resource) {
  const page = await context.newPage();

  try {
    // Set a reasonable timeout
    page.setDefaultTimeout(30000);

    // Navigate to the page
    console.log('   📥 Loading page...');
    await page.goto(resource.url, {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });

    // Wait a bit for dynamic content to load
    await page.waitForTimeout(2000);

    // Hide cookie banners and popups with CSS
    await page.addStyleTag({
      content: `
        /* Hide common cookie consent banners */
        [class*="cookie"],
        [id*="cookie"],
        [class*="consent"],
        [id*="consent"],
        [class*="gdpr"],
        [id*="gdpr"],
        [aria-label*="cookie"],
        [aria-label*="consent"],
        .onetrust-pc-dark-filter,
        #onetrust-consent-sdk,
        .osano-cm-window,
        .cc-window,
        .cookie-banner,
        [class*="CookieBanner"],
        [id*="CookieBanner"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
        }
      `,
    });

    // Wait a moment for CSS to apply
    await page.waitForTimeout(500);

    // Take screenshot
    console.log('   📸 Taking screenshot...');
    const screenshotPath = path.join(THUMBS_DIR, `${resource.slug}.png`);

    await page.screenshot({
      path: screenshotPath,
      fullPage: false, // Just the viewport
      type: 'png',
    });

    console.log(`   💾 Saved: ${resource.slug}.png`);
    return true;
  } catch (error) {
    console.log(`   ⚠️  Screenshot failed: ${error.message}`);
    return false;
  } finally {
    await page.close();
  }
}

async function getResourcesNeedingThumbnails() {
  const { data, error } = await supabase
    .from('kb_resource')
    .select('slug, title, url, thumbnail')
    .eq('status', 'published')
    .order('date_added', { ascending: false });

  if (error) {
    console.error('Error fetching resources:', error);
    return [];
  }

  // Filter resources that don't have thumbnails or have external thumbnails
  const needingThumbnails = data.filter((resource) => {
    // Check if local thumbnail file exists
    const localPaths = [
      path.join(THUMBS_DIR, `${resource.slug}.png`),
      path.join(THUMBS_DIR, `${resource.slug}.webp`),
      path.join(THUMBS_DIR, `${resource.slug}.jpg`),
    ];

    const hasLocalThumbnail = localPaths.some((p) => fs.existsSync(p));

    // Need thumbnail if:
    // 1. No local file exists AND
    // 2. No thumbnail field OR thumbnail field is external URL
    return !hasLocalThumbnail && (!resource.thumbnail || resource.thumbnail.startsWith('http'));
  });

  return needingThumbnails;
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
