#!/usr/bin/env node
/**
 * Enrichment Agent - Generates summaries and tags using full taxonomies from database
 *
 * Usage:
 *   node scripts/enrich.mjs              # Enrich all pending
 *   node scripts/enrich.mjs --limit=5    # Limit to 5 items
 *   node scripts/enrich.mjs --dry-run    # Preview only
 *
 * Requires: OPENAI_API_KEY in .env
 * Schema: Pulls taxonomy values from bfsi_industry, bfsi_topic tables
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Cache for taxonomy values
let TAXONOMIES = null;

async function loadTaxonomies() {
  if (TAXONOMIES) return TAXONOMIES;

  console.log('📚 Loading taxonomies from database...');

  const [industries, topics] = await Promise.all([
    supabase.from('bfsi_industry').select('slug, label, level').order('sort_order'),
    supabase.from('bfsi_topic').select('slug, label, level').order('sort_order'),
  ]);

  if (industries.error || topics.error) {
    throw new Error('Failed to load taxonomies from database');
  }

  TAXONOMIES = {
    role: ['executive', 'professional', 'academic'],
    industry: industries.data.map((i) => i.slug),
    topic: topics.data.map((t) => t.slug),
    content_type: [
      'report',
      'white-paper',
      'peer-reviewed-paper',
      'article',
      'presentation',
      'webinar',
      'dataset',
      'website',
      'policy-document',
    ],
    geography: ['eu', 'uk', 'us', 'nl', 'global', 'other'],
    use_cases: [
      'customer-onboarding',
      'identity-verification',
      'document-processing',
      'transaction-monitoring',
      'credit-assessment',
      'fraud-detection',
      'claims-handling',
      'portfolio-analytics',
      'regulatory-reporting',
      'audit-support',
    ],
    agentic_capabilities: [
      'reasoning',
      'planning',
      'memory',
      'tool-use',
      'collaboration',
      'autonomy',
      'evaluation',
      'monitoring',
    ],
  };

  console.log(
    `   ✓ Loaded ${TAXONOMIES.industry.length} industries, ${TAXONOMIES.topic.length} topics\n`,
  );

  return TAXONOMIES;
}

async function enrich(options = {}) {
  const { limit, dryRun = false } = options;
  console.log('🧠 Starting enrichment...');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n`);

  await loadTaxonomies();

  const { data: items, error } = await supabase
    .from('ingestion_queue')
    .select('*')
    .eq('status', 'pending')
    .limit(limit || 100);
  if (error) throw error;

  const itemsToEnrich = items.filter((item) => !item.payload?.summary?.short);
  if (itemsToEnrich.length === 0) {
    console.log('✅ No items to enrich!');
    return { enriched: 0 };
  }

  console.log(`Found ${itemsToEnrich.length} items to enrich\n`);
  let enriched = 0;

  for (const item of itemsToEnrich) {
    console.log(`📝 ${item.payload.title.substring(0, 60)}...`);
    try {
      const content = item.payload.description || item.payload.title;
      const enrichment = await generateEnrichment(content, item.payload.title);

      if (!dryRun) {
        await supabase
          .from('ingestion_queue')
          .update({
            payload: { ...item.payload, summary: enrichment.summary, tags: enrichment.tags },
            prompt_version: 'v2.0-db-taxonomy',
            model_id: 'gpt-4o-mini',
          })
          .eq('id', item.id);
        console.log(
          `   ✅ ${enrichment.tags.role} | ${enrichment.tags.industry} | ${enrichment.tags.topic}`,
        );
      } else {
        console.log(`   [DRY] ${enrichment.summary.short.substring(0, 60)}...`);
      }
      enriched++;
      await new Promise((r) => setTimeout(r, 1000));
    } catch (error) {
      console.error(`   ❌ ${error.message}`);
    }
  }
  console.log(`\n📊 Enriched ${enriched}/${itemsToEnrich.length}`);
  return { enriched };
}

async function generateEnrichment(content, title) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');

  const taxonomies = await loadTaxonomies();

  const prompt = `You are a BFSI AI analyst. Analyze this resource and return ONLY valid JSON.

Title: ${title}
Content: ${content}

Return JSON with this structure. Pick the SINGLE MOST SPECIFIC value for each field:

{
  "summary": {
    "short": "120-240 characters - concise summary for cards",
    "medium": "240-480 characters - detailed analysis with BFSI context",
    "long": "640-1120 characters - comprehensive analysis with implications"
  },
  "tags": {
    "role": "ONE OF: ${taxonomies.role.join(', ')}",
    "industry": "ONE OF (pick MOST SPECIFIC): ${taxonomies.industry.join(', ')}",
    "topic": "ONE OF (pick MOST SPECIFIC): ${taxonomies.topic.join(', ')}",
    "content_type": "ONE OF: ${taxonomies.content_type.join(', ')}",
    "geography": "ONE OF: ${taxonomies.geography.join(', ')} (regulatory OR market focus)",
    "use_cases": "ONE OF: ${taxonomies.use_cases.join(', ')}",
    "agentic_capabilities": "ONE OF: ${taxonomies.agentic_capabilities.join(', ')}"
  }
}

RULES:
1. Pick EXACTLY ONE value per field
2. Use most SPECIFIC hierarchical value (e.g., "technology-and-data-agentic-engineering" not "technology-and-data")
3. All lowercase, hyphenated
4. Geography: if regulatory focus → jurisdiction, if market focus → geographic region
5. If no clear fit, use parent category (e.g., "banking" if no specific subsector)`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    }),
  });

  if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  enrich({
    limit: parseInt(args.find((a) => a.startsWith('--limit='))?.split('=')[1]) || null,
    dryRun: args.includes('--dry-run'),
  })
    .then(() => {
      console.log('\n✨ Complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Failed:', error);
      process.exit(1);
    });
}

export default enrich;
