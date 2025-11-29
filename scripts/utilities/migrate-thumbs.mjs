import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Initialize Supabase (needs SERVICE_KEY to bypass RLS and update rows)
if (!process.env.SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const THUMBS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../public/thumbs');

async function migrate() {
  console.log('🚀 Starting thumbnail migration to Cloud Storage...');

  if (!fs.existsSync(THUMBS_DIR)) {
    console.error('❌ Thumbs directory not found:', THUMBS_DIR);
    return;
  }

  const files = fs.readdirSync(THUMBS_DIR).filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f));
  console.log(`📋 Found ${files.length} local thumbnails.`);

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (const file of files) {
    // Assume filename is slug + extension (e.g. "my-article.png")
    const slug = file.replace(/\.[^/.]+$/, '');
    const ext = path.extname(file).toLowerCase();
    let contentType = 'image/jpeg';
    if (ext === '.png') contentType = 'image/png';
    if (ext === '.webp') contentType = 'image/webp';

    console.log(`\nProcessing: ${file} (Slug: ${slug})`);

    // 1. Find Publication
    const { data: pub, error: findError } = await supabase
      .from('kb_publication')
      .select('id, thumbnail_path, thumbnail_bucket')
      .eq('slug', slug)
      .maybeSingle();

    if (findError) {
      console.error(`   ❌ DB Error finding slug: ${findError.message}`);
      failCount++;
      continue;
    }

    if (!pub) {
      console.log(`   ⚠️  Publication not found for slug: "${slug}". Skipping file.`);
      skipCount++;
      continue;
    }

    // 2. Check if already migrated (has a path)
    if (pub.thumbnail_path) {
      console.log(`   ⏭️  Already has cloud thumbnail (${pub.thumbnail_path}). Skipping.`);
      skipCount++;
      continue;
    }

    // 3. Upload to Storage
    const fileBuffer = fs.readFileSync(path.join(THUMBS_DIR, file));
    const storagePath = `thumbnails/${file}`; // Keep original filename

    const { error: uploadError } = await supabase.storage
      .from('asset')
      .upload(storagePath, fileBuffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error(`   ❌ Upload failed: ${uploadError.message}`);
      failCount++;
      continue;
    }

    // 4. Update Database
    const { error: updateError } = await supabase
      .from('kb_publication')
      .update({
        thumbnail_bucket: 'asset',
        thumbnail_path: storagePath,
        // Optional: update legacy 'thumbnail' column to full URL for backward compat if needed
        // thumbnail: `${process.env.PUBLIC_SUPABASE_URL}/storage/v1/object/public/asset/${storagePath}`
      })
      .eq('id', pub.id);

    if (updateError) {
      console.error(`   ❌ DB Update failed: ${updateError.message}`);
      failCount++;
    } else {
      console.log(`   ✅ Uploaded & Linked: asset/${storagePath}`);
      successCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`Migration Complete!`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`⏭️  Skipped: ${skipCount}`);
  console.log(`❌ Failed:  ${failCount}`);
  console.log('='.repeat(50));
}

migrate().catch((err) => console.error(err));
