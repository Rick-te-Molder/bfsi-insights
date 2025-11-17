#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const sanitizeUrl = (url) => {
  if (!url) return null;
  const normalized = url.startsWith('http') ? url : `https://${url}`;
  return encodeURI(normalized.replace(/^http:\/\//i, 'https://'));
};

const needsThumbnail = (resource) => {
  if (!resource.thumbnail) return true;
  return /%(2f|3a)/i.test(resource.thumbnail);
};

async function main() {
  console.log(
    '🖼️  Adding thum.io thumbnail URLs to resources without thumbnails or with encoded placeholders...',
  );

  // Get resources that need thumbnail fixes
  const { data: resources, error } = await supabase
    .from('kb_resource')
    .select('id, slug, title, url, thumbnail')
    .eq('status', 'published');

  if (error) {
    console.error('Error fetching resources:', error);
    process.exit(1);
  }

  const needingUpdate = resources.filter(needsThumbnail);

  if (needingUpdate.length === 0) {
    console.log('✅ All resources already have usable thumbnails!');
    return;
  }

  console.log(`📋 Found ${needingUpdate.length} resources needing thumbnail fixes`);

  let updated = 0;
  let failed = 0;

  for (const resource of needingUpdate) {
    const targetUrl = sanitizeUrl(resource.url);
    if (!targetUrl) {
      console.warn(`Skipping ${resource.slug} due to invalid URL (${resource.url})`);
      continue;
    }

    // Generate thum.io URL
    const thumbnailUrl = `https://image.thum.io/get/nojs/width/640/crop/640/${encodeURIComponent(targetUrl)}`;

    console.log(`Updating: ${resource.title}`);
    console.log(`  URL: ${thumbnailUrl}`);

    // Update the resource
    const { error: updateError } = await supabase
      .from('kb_resource')
      .update({ thumbnail: thumbnailUrl })
      .eq('id', resource.id);

    if (updateError) {
      console.error(`  ❌ Failed: ${updateError.message}`);
      failed++;
    } else {
      console.log(`  ✅ Updated`);
      updated++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));
  console.log(`✅ Updated: ${updated}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('\n✨ Done!');
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
