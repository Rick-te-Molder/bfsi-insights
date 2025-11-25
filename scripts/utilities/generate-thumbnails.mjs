#!/usr/bin/env node

import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const THUMBS_DIR = path.join(__dirname, '../../public/thumbs');

// Ensure thumbs directory exists
if (!fs.existsSync(THUMBS_DIR)) {
  fs.mkdirSync(THUMBS_DIR, { recursive: true });
}

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;

  console.log('🖼️  Starting thumbnail generation...');
  if (limit) {
    console.log(`   Limit: ${limit} publications`);
  }

  // Get publications that need thumbnails
  const publications = await getPublicationsNeedingThumbnails(limit);

  if (publications.length === 0) {
    console.log('✅ All publications already have thumbnails!');
    return;
  }

  console.log(`📋 Found ${publications.length} publications needing thumbnails:`);
  publications.forEach((p, i) => {
    console.log(`   ${i + 1}. ${p.title}`);
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

  // Process each publication
  for (let i = 0; i < publications.length; i++) {
    const publication = publications[i];
    console.log(`[${i + 1}/${publications.length}] Processing: ${publication.title}`);
    console.log(`   URL: ${publication.url}`);

    try {
      const success = await generateThumbnail(context, publication);
      results.push({ publication, success });

      if (success) {
        console.log('   ✅ Thumbnail generated successfully');
      } else {
        console.log('   ❌ Failed to generate thumbnail');
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      results.push({ publication, success: false, error: error.message });
    }

    // Small delay between requests
    if (i < publications.length - 1) {
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
    console.log('\nFailed publications:');
    results
      .filter((r) => !r.success)
      .forEach(({ publication, error }) => {
        console.log(`• ${publication.title} (${error || 'Unknown error'})`);
      });
  }

  console.log('\n✨ Done!');
}

async function generateThumbnail(context, publication) {
  const page = await context.newPage();

  try {
    // Set a reasonable timeout
    page.setDefaultTimeout(30000);

    // Navigate to the page
    console.log('   📥 Loading page...');
    await page.goto(publication.url, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Wait for page to be fully rendered
    await page.waitForTimeout(3000);

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
    const screenshotPath = path.join(THUMBS_DIR, `${publication.slug}.png`);

    await page.screenshot({
      path: screenshotPath,
      fullPage: false, // Just the viewport
      type: 'png',
    });

    console.log(`   💾 Saved: ${publication.slug}.png`);

    // Update database with thumbnail path
    const thumbnailPath = `/thumbs/${publication.slug}.png`;
    const { error: updateError } = await supabase
      .from('kb_publication')
      .update({ thumbnail: thumbnailPath })
      .eq('slug', publication.slug);

    if (updateError) {
      console.log(`   ⚠️  Database update failed: ${updateError.message}`);
    } else {
      console.log(`   ✅ Database updated with thumbnail path`);
    }

    return true;
  } catch (error) {
    console.log(`   ⚠️  Screenshot failed: ${error.message}`);
    return false;
  } finally {
    await page.close();
  }
}

async function getPublicationsNeedingThumbnails(limit = null) {
  let query = supabase
    .from('kb_publication')
    .select('slug, title, source_url, thumbnail')
    .eq('status', 'published')
    .is('thumbnail', null)
    .order('date_added', { ascending: false });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching publications:', error);
    return [];
  }

  // Map to expected format with url property
  return data.map((pub) => ({
    slug: pub.slug,
    title: pub.title,
    url: pub.source_url,
    thumbnail: pub.thumbnail,
  }));
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
