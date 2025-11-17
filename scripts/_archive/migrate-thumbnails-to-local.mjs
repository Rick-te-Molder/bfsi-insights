#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Get all thumbnail files from public/thumbs
const thumbsDir = 'public/thumbs';
const thumbFiles = fs.readdirSync(thumbsDir).filter((f) => /\.(webp|png|jpe?g)$/i.test(f));

console.log(`Found ${thumbFiles.length} thumbnail files`);

// Fetch all resources from database
const { data: resources, error } = await supabase
  .from('kb_resource')
  .select('id, slug, thumbnail')
  .eq('status', 'published');

if (error) {
  console.error('Error fetching resources:', error);
  process.exit(1);
}

console.log(`Found ${resources.length} published resources\n`);

const updates = [];
const missing = [];

for (const resource of resources) {
  const { id, slug, thumbnail } = resource;

  // Skip if already has local path
  if (thumbnail && thumbnail.startsWith('/thumbs/')) {
    console.log(`✓ ${slug}: already has local path`);
    continue;
  }

  // Find matching thumbnail file
  const matchingFiles = thumbFiles.filter((f) => f.includes(slug));

  if (matchingFiles.length === 0) {
    missing.push(slug);
    console.log(`⚠ ${slug}: no thumbnail file found`);
    continue;
  }

  // Prefer .webp, then .png, then .jpg
  const extPriority = { '.webp': 0, '.png': 1, '.jpg': 2, '.jpeg': 3 };
  const getExt = (f) => path.extname(f).toLowerCase();
  matchingFiles.sort((a, b) => {
    const pa = extPriority[getExt(a)] ?? 99;
    const pb = extPriority[getExt(b)] ?? 99;
    return pa - pb;
  });

  const bestMatch = matchingFiles[0];
  const localPath = `/thumbs/${bestMatch}`;

  updates.push({
    id,
    slug,
    thumbnail: localPath,
    oldThumbnail: thumbnail,
  });

  console.log(`→ ${slug}: ${thumbnail || 'null'} → ${localPath}`);
}

console.log(`\n=== Summary ===`);
console.log(`Resources to update: ${updates.length}`);
console.log(`Missing thumbnails: ${missing.length}`);

if (missing.length > 0) {
  console.log(`\nMissing thumbnails for:`);
  missing.forEach((slug) => console.log(`  - ${slug}`));
}

if (updates.length === 0) {
  console.log('\nNo updates needed!');
  process.exit(0);
}

// Ask for confirmation
console.log(`\nReady to update ${updates.length} resources.`);
console.log('Run with --dry-run to preview without updating.');
const isDryRun = process.argv.includes('--dry-run');

if (isDryRun) {
  console.log('\n🔍 DRY RUN - No changes made');
  process.exit(0);
}

// Perform updates
let successCount = 0;
let errorCount = 0;

for (const update of updates) {
  const { error: updateError } = await supabase
    .from('kb_resource')
    .update({ thumbnail: update.thumbnail })
    .eq('id', update.id);

  if (updateError) {
    console.error(`✗ Failed to update ${update.slug}:`, updateError.message);
    errorCount++;
  } else {
    successCount++;
  }
}

console.log(`\n=== Results ===`);
console.log(`✓ Successfully updated: ${successCount}`);
console.log(`✗ Failed: ${errorCount}`);

if (successCount > 0) {
  console.log('\n🎉 Done! Run `npm run build:resources` to regenerate resources.json');
}
