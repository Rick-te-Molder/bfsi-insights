#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function enrich(options = {}) {
  const { limit, dryRun = false } = options;
  console.log('🧠 Starting enrichment...');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n`);

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
            prompt_version: 'v1.1',
            model_id: 'gpt-4o-mini',
          })
          .eq('id', item.id);
        console.log(
          `   ✅ Role: ${enrichment.tags.role}, Industry: ${enrichment.tags.industry}, Topic: ${enrichment.tags.topic}`,
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

  const prompt = `You are a BFSI analyst. Analyze this resource and return ONLY valid JSON.

Title: ${title}
Content: ${content}

Return JSON with this EXACT structure. Pick ONE value per field from the allowed list:

{
  "summary": {
    "short": "35-50 word elevator pitch",
    "medium": "120-180 word analysis with BFSI implications",
    "long": "300+ word comprehensive analysis"
  },
  "tags": {
    "role": "PICK ONE: executive OR practitioner OR academic",
    "industry": "PICK ONE: banking OR insurance OR fintech OR wealth-management OR payments OR general",
    "topic": "PICK ONE: agentic-ai OR generative-ai OR machine-learning OR risk-management OR customer-experience OR regulatory-compliance OR data-analytics",
    "content_type": "PICK ONE: article OR report OR peer-reviewed-paper OR whitepaper OR blog-article",
    "jurisdiction": "PICK ONE: EU OR US OR UK OR APAC OR global OR none",
    "use_cases": ["array of 2-5 specific BFSI use cases"],
    "agentic_capabilities": ["array of 2-5 agent capabilities if mentioned, else empty array"]
  }
}

CRITICAL: Each tag field MUST be exactly ONE of the allowed values. Do NOT invent new values.`;

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
