#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  console.log('🖼️  Adding thum.io thumbnail URLs to resources without thumbnails...');

  // Get resources without thumbnails
  const { data: resources, error } = await supabase
    .from('kb_resource')
    .select('id, slug, title, url, thumbnail')
    .eq('status', 'published')
    .or('thumbnail.is.null,thumbnail.eq.');

  if (error) {
    console.error('Error fetching resources:', error);
    process.exit(1);
  }

  if (resources.length === 0) {
    console.log('✅ All resources already have thumbnails!');
    return;
  }

  console.log(`📋 Found ${resources.length} resources without thumbnails`);

  let updated = 0;
  let failed = 0;

  for (const resource of resources) {
    // Generate thum.io URL
    const thumbnailUrl = `https://image.thum.io/get/nojs/width/640/crop/640/${encodeURIComponent(resource.url)}`;

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
