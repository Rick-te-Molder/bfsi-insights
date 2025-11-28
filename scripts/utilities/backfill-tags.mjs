import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function backfill() {
  console.log('🔄 Starting tag backfill for published articles...');

  // 1. Get IDs of articles that already have tags
  const { data: taggedIds } = await supabase
    .from('kb_publication_bfsi_industry')
    .select('publication_id');
  
  const taggedIdSet = new Set((taggedIds || []).map(x => x.publication_id));

  // 2. Fetch ALL published articles
  const { data: allPubs, error } = await supabase
    .from('kb_publication')
    .select('id, title, source_url, summary_short');

  if (error) {
    console.error('❌ Error fetching articles:', error);
    return;
  }

  // 3. Filter for missing tags
  const missingTags = allPubs.filter(p => !taggedIdSet.has(p.id));

  console.log(`📋 Found ${missingTags.length} articles missing tags.`);

  // 2. Add them to ingestion queue as 'filtered' (ready for enrichment)
  let added = 0;
  for (const pub of missingTags) {
    // Check if already in queue
    const { data: existing } = await supabase
      .from('ingestion_queue')
      .select('id')
      .eq('url', pub.source_url)
      .maybeSingle();

    if (existing) {
      console.log(`   ⏭️  Skipping (already in queue): ${pub.title.substring(0, 40)}...`);
      
      // Force update status if it was stuck
      await supabase
        .from('ingestion_queue')
        .update({ status: 'filtered' })
        .eq('id', existing.id);
        
      continue;
    }

    // Insert into queue
    const { error: insertError } = await supabase
      .from('ingestion_queue')
      .insert({
        url: pub.source_url,
        status: 'filtered', // Skip fetch/filter, go straight to enrich
        content_type: 'publication',
        payload: {
          title: pub.title,
          summary: { short: pub.summary_short }, // Pass existing summary
          manual_submission: true,
          is_backfill: true,
          original_pub_id: pub.id
        }
      });

    if (insertError) {
      console.error(`   ❌ Failed to add: ${pub.title}`, insertError.message);
    } else {
      console.log(`   ✅ Added to queue: ${pub.title.substring(0, 40)}...`);
      added++;
    }
  }

  console.log(`\n✨ Queued ${added} articles for enrichment.`);
  console.log('👉 Run: node scripts/agents/enrich.mjs --limit=80');
}

backfill();