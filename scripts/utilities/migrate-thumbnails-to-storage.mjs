#!/usr/bin/env node
/**
 * Migrate Thumbnails to Supabase Storage
 *
 * Migrates existing thumbnail PNGs from public/thumbs/ to Supabase Storage.
 * Updates kb_publication records with new storage paths.
 *
 * Usage:
 *   node scripts/utilities/migrate-thumbnails-to-storage.mjs              # Migrate all
 *   node scripts/utilities/migrate-thumbnails-to-storage.mjs --dry-run    # Preview only
 *   node scripts/utilities/migrate-thumbnails-to-storage.mjs --limit=10   # Limit to 10
 */

import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const THUMBS_DIR = path.resolve(__dirname, '../../public/thumbs');
const BUCKET = 'asset';
const STORAGE_PREFIX = 'thumbnails';

async function migrateThumbnaails(options = {}) {
  const { dryRun = false, limit = null } = options;

  console.log('🖼️  Thumbnail Migration to Supabase Storage');
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  if (limit) console.log(`   Limit: ${limit}`);
  console.log('');

  // 1. Read all files in public/thumbs/
  const files = fs.readdirSync(THUMBS_DIR).filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f));

  console.log(`📁 Found ${files.length} thumbnail files in ${THUMBS_DIR}`);

  // 2. Load all publications to match by thumbnail or slug
  const { data: publications, error: pubError } = await supabase
    .from('kb_publication')
    .select('id, slug, thumbnail, thumbnail_bucket, thumbnail_path')
    .order('date_published', { ascending: false });

  if (pubError) {
    console.error('❌ Failed to load publications:', pubError.message);
    return;
  }

  console.log(`📚 Found ${publications.length} publications in database\n`);

  // Build lookup maps
  const byThumbnail = new Map();
  const bySlug = new Map();
  for (const pub of publications) {
    if (pub.thumbnail) {
      // Normalize: /thumbs/xxx.png -> xxx
      const thumbFile = path.basename(pub.thumbnail).replace(/\.(png|jpg|jpeg|webp)$/i, '');
      byThumbnail.set(thumbFile, pub);
    }
    if (pub.slug) {
      bySlug.set(pub.slug, pub);
    }
  }

  let migrated = 0;
  let skipped = 0;
  let notFound = 0;
  let errors = 0;

  const filesToProcess = limit ? files.slice(0, limit) : files;

  for (const file of filesToProcess) {
    const fileName = path.basename(file, path.extname(file));
    const ext = path.extname(file).toLowerCase();
    const filePath = path.join(THUMBS_DIR, file);

    // Skip .gitkeep
    if (file === '.gitkeep') continue;

    // Find matching publication
    let publication = byThumbnail.get(fileName) || bySlug.get(fileName);

    if (!publication) {
      console.log(`   ⚠️  No matching publication: ${file}`);
      notFound++;
      continue;
    }

    // Skip if already migrated to storage
    if (publication.thumbnail_path && publication.thumbnail_bucket) {
      console.log(`   ⏭️  Already migrated: ${file}`);
      skipped++;
      continue;
    }

    const storagePath = `${STORAGE_PREFIX}/${publication.id}.jpg`;

    if (dryRun) {
      console.log(`   📤 [DRY] Would upload: ${file} → ${storagePath}`);
      migrated++;
      continue;
    }

    try {
      // Read file
      const fileBuffer = fs.readFileSync(filePath);

      // Determine content type
      let contentType = 'image/png';
      if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
      else if (ext === '.webp') contentType = 'image/webp';

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, fileBuffer, {
          contentType,
          upsert: true,
        });

      if (uploadError) {
        console.error(`   ❌ Upload failed: ${file} - ${uploadError.message}`);
        errors++;
        continue;
      }

      // Update publication record
      const { error: updateError } = await supabase
        .from('kb_publication')
        .update({
          thumbnail_bucket: BUCKET,
          thumbnail_path: storagePath,
        })
        .eq('id', publication.id);

      if (updateError) {
        console.error(`   ❌ DB update failed: ${file} - ${updateError.message}`);
        errors++;
        continue;
      }

      console.log(`   ✅ Migrated: ${file} → ${storagePath}`);
      migrated++;

      // Rate limit
      await new Promise((r) => setTimeout(r, 100));
    } catch (err) {
      console.error(`   ❌ Error: ${file} - ${err.message}`);
      errors++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   Migrated:   ${migrated}`);
  console.log(`   Skipped:    ${skipped} (already migrated)`);
  console.log(`   Not found:  ${notFound} (no matching publication)`);
  console.log(`   Errors:     ${errors}`);

  if (!dryRun && migrated > 0) {
    console.log('\n💡 Next steps:');
    console.log('   1. Verify thumbnails load correctly on the site');
    console.log('   2. Delete public/thumbs/ folder from git');
    console.log('   3. Update .gitignore if needed');
  }
}

// Parse CLI args
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  limit: null,
};

const limitArg = args.find((a) => a.startsWith('--limit='));
if (limitArg) {
  options.limit = parseInt(limitArg.split('=')[1], 10);
}

migrateThumbnaails(options).catch(console.error);
