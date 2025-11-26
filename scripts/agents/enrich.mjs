#!/usr/bin/env node
/**
 * Enrichment Agent - Generates summaries, tags, and thumbnails using BFSI taxonomies
 *
 * Usage:
 *   node scripts/agents/enrich.mjs
 *   node scripts/agents/enrich.mjs --limit=5
 *   node scripts/agents/enrich.mjs --dry-run
 */

import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  startAgentRun,
  finishAgentRunSuccess,
  finishAgentRunError,
  startStep,
  finishStepSuccess,
  finishStepError,
  addMetric,
} from '../lib/agent-run.mjs';

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl) throw new Error('Missing PUBLIC_SUPABASE_URL or SUPABASE_URL');
if (!supabaseServiceKey) throw new Error('Missing SUPABASE_SERVICE_KEY');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const THUMBS_DIR = path.join(__dirname, '../public/thumbs');

// ---------------------------------------------------------------------------
// Caches
// ---------------------------------------------------------------------------

/**
 * TAXONOMIES structure:
 * {
 *   role: string[],
 *   industry: string[],
 *   topic: string[],
 *   content_type: string[],
 *   content_type_weights: Record<string, number>,
 *   geography: string[],
 *   use_cases: string[],
 *   agentic_capabilities: string[],
 *   source_weights: Record<string, number>
 * }
 */
let TAXONOMIES = null;

// ---------------------------------------------------------------------------
// Quality score
// ---------------------------------------------------------------------------

function calculateQualityScore(item, enrichment) {
  const tax = TAXONOMIES || {};

  const sourceWeights = tax.source_weights || {};
  const contentTypeWeights = tax.content_type_weights || {};

  const sourceName =
    item.payload?.source || item.payload?.source_name || item.payload?.publisher || null;

  const contentType = enrichment.tags?.content_type || null;

  // Default baselines
  const defaultSourceScore = 0.6;
  const defaultTypeScore = 0.6;

  const sourceScore =
    (sourceName && sourceWeights[sourceName]) != null
      ? sourceWeights[sourceName]
      : defaultSourceScore;

  const typeScore =
    (contentType && contentTypeWeights[contentType]) != null
      ? contentTypeWeights[contentType]
      : defaultTypeScore;

  // Recency score based on published_at or discovered_at
  const publishedDate = new Date(item.payload?.published_at || item.discovered_at);
  const ageDays = (Date.now() - publishedDate.getTime()) / 86400000;

  const recencyScore = ageDays < 30 ? 1.0 : ageDays < 90 ? 0.9 : ageDays < 180 ? 0.8 : 0.7;

  const relevanceConfidence = enrichment.relevance_confidence || 0.5;

  const score =
    sourceScore * 0.35 + typeScore * 0.2 + recencyScore * 0.15 + relevanceConfidence * 0.3;

  return Math.round(score * 100) / 100;
}

// ---------------------------------------------------------------------------
// Taxonomies
// ---------------------------------------------------------------------------

async function loadTaxonomies() {
  if (TAXONOMIES) return TAXONOMIES;

  console.log('📚 Loading taxonomies from database...');

  const [
    industries,
    topics,
    roles,
    publicationTypes,
    useCases,
    capabilities,
    sources,
    geographies,
  ] = await Promise.all([
    supabase.from('bfsi_industry').select('code, name, level').order('sort_order'),
    supabase.from('bfsi_topic').select('code, name, level').order('sort_order'),
    supabase.from('kb_role').select('*').order('sort_order'),
    supabase.from('kb_publication_type').select('code, sort_order').order('sort_order'),
    supabase.from('ag_use_case').select('code').order('code'),
    supabase.from('ag_capability').select('code').order('code'),
    supabase.from('kb_source').select('name, tier, category, enabled').eq('enabled', true),
    supabase.from('kb_geography').select('code').order('sort_order'),
  ]);

  if (industries.error) {
    throw new Error(`bfsi_industry fetch failed: ${industries.error.message}`);
  }
  if (topics.error) {
    throw new Error(`bfsi_topic fetch failed: ${topics.error.message}`);
  }
  if (roles.error) {
    throw new Error(`kb_role fetch failed: ${roles.error.message}`);
  }
  if (publicationTypes.error) {
    throw new Error(`kb_publication_type fetch failed: ${publicationTypes.error.message}`);
  }
  if (useCases.error) {
    throw new Error(`ag_use_case fetch failed: ${useCases.error.message}`);
  }
  if (capabilities.error) {
    throw new Error(`ag_capability fetch failed: ${capabilities.error.message}`);
  }
  if (sources.error) {
    throw new Error(`kb_source fetch failed: ${sources.error.message}`);
  }
  if (geographies.error) {
    throw new Error(`kb_geography fetch failed: ${geographies.error.message}`);
  }

  const industryCodes = (industries.data || []).map((i) => i.code).filter(Boolean);
  const topicCodes = (topics.data || []).map((t) => t.code).filter(Boolean);

  const roleCodes = (roles.data || [])
    .map((r) => r.code || r.slug || r.value || r.name)
    .filter(Boolean);

  const contentTypeCodes = (publicationTypes.data || []).map((t) => t.code).filter(Boolean);

  // Use default weight of 0.7 for all content types since quality_weight column doesn't exist
  const contentTypeWeights = Object.fromEntries(
    (publicationTypes.data || []).map((t) => [t.code, 0.7]),
  );

  const useCaseCodes = (useCases.data || []).map((u) => u.code).filter(Boolean);

  const capabilityCodes = (capabilities.data || []).map((c) => c.code).filter(Boolean);

  const geographyCodes = (geographies.data || []).map((g) => g.code).filter(Boolean);

  const tierDefaults = {
    premium: 1.0,
    standard: 0.85,
    basic: 0.7,
  };

  const categoryDefaults = {
    regulator: 1.0,
    research: 0.9,
    'strategy-consulting': 0.95,
    publication: 0.85,
  };

  const sourceWeights = {};
  for (const s of sources.data || []) {
    const base = tierDefaults[s.tier] ?? 0.7;
    const catBase = categoryDefaults[s.category] ?? base;
    // Blend tier and category for a smooth score
    const weight = (base + catBase) / 2;
    sourceWeights[s.name] = weight;
  }

  TAXONOMIES = {
    role: roleCodes,
    industry: industryCodes,
    topic: topicCodes,
    content_type: contentTypeCodes,
    content_type_weights: contentTypeWeights,
    geography: geographyCodes,
    use_cases: useCaseCodes,
    agentic_capabilities: capabilityCodes,
    source_weights: sourceWeights,
  };

  console.log(
    `   ✓ Roles:        ${TAXONOMIES.role.length}\n` +
      `   ✓ Industries:   ${TAXONOMIES.industry.length}\n` +
      `   ✓ Topics:       ${TAXONOMIES.topic.length}\n` +
      `   ✓ Types:        ${TAXONOMIES.content_type.length}\n` +
      `   ✓ Geographies:  ${TAXONOMIES.geography.length}\n` +
      `   ✓ Use cases:    ${TAXONOMIES.use_cases.length}\n` +
      `   ✓ Capabilities: ${TAXONOMIES.agentic_capabilities.length}\n` +
      `   ✓ Sources:      ${Object.keys(TAXONOMIES.source_weights).length}\n`,
  );

  return TAXONOMIES;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

async function enrich(options = {}) {
  let run_id = null;

  try {
    const { limit, dryRun = false } = options;

    console.log('🧠 Enrichment starting...');
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n`);

    const taxonomies = await loadTaxonomies();

    // Start run
    run_id = await startAgentRun({
      agent_name: 'enrich',
      stage: 'enrichment',
      model_id: 'gpt-5.1',
      prompt_version: 'v3.0-bfsi-filter',
      agent_metadata: { dryRun, limit, taxonomies_hash: Object.keys(taxonomies).length },
    });

    // Load pending and fetched items from ingestion_queue
    const { data: items, error } = await supabase
      .from('ingestion_queue')
      .select('*')
      .in('status', ['pending'])
      .order('discovered_at', { ascending: false })
      .limit(limit || 100);

    if (error) throw new Error('Failed to load items: ' + error.message);

    // Filter: must not have summary AND must have content (title or description)
    const itemsToEnrich = (items || []).filter(
      (i) => !i.payload?.summary?.short && (i.payload?.title || i.payload?.description),
    );

    const itemsNeedingFetch = (items || []).filter(
      (i) => !i.payload?.title && !i.payload?.description,
    );

    if (itemsNeedingFetch.length > 0) {
      console.log(`⚠️  ${itemsNeedingFetch.length} items need content fetching first`);
      console.log('   Run: node scripts/agents/fetch-queue.mjs\n');
    }

    if (itemsToEnrich.length === 0) {
      console.log('No items to enrich');
      await addMetric(run_id, 'items_found', 0);
      await finishAgentRunSuccess(run_id);
      return;
    }

    console.log(`Found ${itemsToEnrich.length} items\n`);

    let processed = 0;
    let enriched = 0;
    let failed = 0;

    for (const item of itemsToEnrich) {
      processed++;
      const displayTitle = item.payload?.title || item.url || 'Unknown';
      console.log(`📝 ${displayTitle.substring(0, 60)}...`);

      const content = item.payload?.description || item.payload?.title || item.url;
      const step_id = await startStep(run_id, processed, 'enrich-item', (content || '').length, {
        queue_id: item.id,
      });

      try {
        const enrichment = await generateEnrichment(content, displayTitle);

        // Auto-reject
        if (enrichment.bfsi_relevant === false) {
          console.log(`   ⚠️ Not BFSI relevant: ${enrichment.relevance_reason}`);

          if (!dryRun) {
            await supabase
              .from('ingestion_queue')
              .update({
                status: 'rejected',
                rejection_reason: enrichment.relevance_reason,
                reviewed_at: new Date().toISOString(),
              })
              .eq('id', item.id);
          }

          await finishStepSuccess(step_id, 0, {
            mode: 'auto-reject',
            reason: enrichment.relevance_reason,
          });

          continue;
        }

        if (!dryRun) {
          // Generate thumbnail
          const thumbnailPath = await generateThumbnail(item);

          const enrichedPayload = {
            ...item.payload,
            summary: enrichment.summary,
            // New format: arrays instead of object
            industry_codes: enrichment.tags?.industry ? [enrichment.tags.industry] : [],
            topic_codes: enrichment.tags?.topic ? [enrichment.tags.topic] : [],
            // Keep tags for backward compatibility
            tags: enrichment.tags || {},
            persona_scores: enrichment.persona_scores || {},
            quality_score: calculateQualityScore(item, enrichment),
            relevance_confidence: enrichment.relevance_confidence || null,
          };

          const { error: updateError } = await supabase
            .from('ingestion_queue')
            .update({
              status: 'enriched',
              payload: enrichedPayload,
              thumb_ref: thumbnailPath,
              prompt_version: 'v3.0-bfsi-filter',
              model_id: 'gpt-5.1',
            })
            .eq('id', item.id);

          if (updateError) {
            await finishStepError(step_id, updateError.message);
            failed++;
            continue;
          }
        }

        enriched++;

        await finishStepSuccess(step_id, JSON.stringify(enrichment).length, {
          role: enrichment.tags?.role || null,
          industry: enrichment.tags?.industry || null,
          topic: enrichment.tags?.topic || null,
          mode: dryRun ? 'dry-run' : 'live',
        });
      } catch (err) {
        console.error(`   ❌ Error: ${err.message || String(err)}`);
        failed++;
        await finishStepError(step_id, err.message || String(err));
      }

      // small spacing delay
      await new Promise((r) => setTimeout(r, 800));
    }

    console.log(`\n📊 Enriched ${enriched}/${itemsToEnrich.length}`);

    await addMetric(run_id, 'items_found', itemsToEnrich.length);
    await addMetric(run_id, 'processed', processed);
    await addMetric(run_id, 'success', enriched);
    await addMetric(run_id, 'failed', failed);

    await finishAgentRunSuccess(run_id);
  } catch (err) {
    console.error('❌ Enrichment failed:', err.message);
    if (run_id) {
      await finishAgentRunError(run_id, err.message || String(err));
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Thumbnail generation
// ---------------------------------------------------------------------------

async function generateThumbnail(item) {
  const slug =
    item.payload.slug ||
    item.url
      .split('/')
      .pop()
      .replace(/[^a-z0-9-]/gi, '-')
      .toLowerCase();

  const paths = [`${slug}.png`, `${slug}.jpg`, `${slug}.webp`].map((name) =>
    path.join(THUMBS_DIR, name),
  );

  const existing = paths.find((p) => fs.existsSync(p));
  if (existing) {
    return `/thumbs/${path.basename(existing)}`;
  }

  try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1200, height: 675 },
    });
    const page = await context.newPage();

    await page.goto(item.url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await page.waitForTimeout(1500);

    const screenshotPath = path.join(THUMBS_DIR, `${slug}.png`);
    await page.screenshot({
      path: screenshotPath,
      fullPage: false,
    });

    await browser.close();

    return `/thumbs/${slug}.png`;
  } catch (err) {
    console.log(`   ⚠️ Thumbnail error: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// LLM enrichment
// ---------------------------------------------------------------------------

async function generateEnrichment(content, title) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY missing');

  const taxonomies = await loadTaxonomies();

  const prompt = generatePrompt(title, content, taxonomies);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5.1',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    }),
  });

  if (!response.ok) throw new Error(`OpenAI API error ${response.status}`);

  const data = await response.json();
  const result = JSON.parse(data.choices[0].message.content);

  // Normalise scalar vs array fields
  if (result.tags?.industry && !Array.isArray(result.tags.industry)) {
    result.tags.industry = [result.tags.industry];
  }

  if (result.tags?.topic && !Array.isArray(result.tags.topic)) {
    result.tags.topic = [result.tags.topic];
  }

  if (result.vendors && !Array.isArray(result.vendors)) {
    result.vendors = result.vendors ? [result.vendors] : [];
  }

  if (result.organizations && !Array.isArray(result.organizations)) {
    result.organizations = result.organizations ? [result.organizations] : [];
  }

  return result;
}

// ---------------------------------------------------------------------------
// Prompt helper
// ---------------------------------------------------------------------------

function generatePrompt(title, content, taxonomies) {
  const safeContent = typeof content === 'string' ? content.slice(0, 8000) : String(content || '');

  return `
You are a senior BFSI and agentic AI analyst.

You receive:
- A TITLE of a publication
- A CONTENT snippet (possibly partial)
- Canonical taxonomies for:
  - role: ${taxonomies.role.join(', ')}
  - industry: ${taxonomies.industry.join(', ')}
  - topic: ${taxonomies.topic.join(', ')}
  - content_type: ${taxonomies.content_type.join(', ')}
  - geography: ${taxonomies.geography.join(', ')}
  - use_cases: ${taxonomies.use_cases.join(', ')}
  - agentic_capabilities: ${taxonomies.agentic_capabilities.join(', ')}

Your tasks:
1. Decide if this publication is BFSI-relevant.
2. If relevant, assign:
   - role (single value from taxonomies.role)
   - industry (one or more codes from taxonomies.industry)
   - topic (one or more codes from taxonomies.topic)
   - content_type (single code from taxonomies.content_type)
   - geography (single value from taxonomies.geography)
   - use_cases (zero or more codes from taxonomies.use_cases)
   - agentic_capabilities (zero or more codes from taxonomies.agentic_capabilities)
3. Generate summaries:
   - summary_short: ~120–240 chars
   - summary_medium: ~240–480 chars
   - summary_long: ~640–1120 chars, suitable for the detail page
4. Produce persona relevance scores in [0,1]:
   - persona_scores.executive
   - persona_scores.professional
   - persona_scores.researcher
5. Provide:
   - relevance_confidence in [0,1]
   - relevance_reason as a short explanation

Input TITLE:
${title}

Input CONTENT:
${safeContent}

Respond as a single JSON object with this structure:

{
  "bfsi_relevant": true | false,
  "relevance_reason": "short string",
  "relevance_confidence": 0.0–1.0,
  "summary": {
    "short": "string",
    "medium": "string",
    "long": "string"
  },
  "tags": {
    "role": "code from taxonomies.role",
    "industry": ["industry-code", "..."],
    "topic": ["topic-code", "..."],
    "content_type": "code from taxonomies.content_type",
    "geography": "value from taxonomies.geography",
    "use_cases": ["use-case-code", "..."],
    "agentic_capabilities": ["capability-code", "..."]
  },
  "persona_scores": {
    "executive": 0.0–1.0,
    "professional": 0.0–1.0,
    "researcher": 0.0–1.0
  },
  "vendors": ["optional vendor names, if clearly mentioned"],
  "organizations": ["optional BFSI organizations mentioned"]
}

Only output valid JSON.
`;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  // Parse limit: supports both --limit=N and --limit N
  let limit = null;
  const limitArgEquals = args.find((a) => a.startsWith('--limit='));
  if (limitArgEquals) {
    limit = parseInt(limitArgEquals.split('=')[1], 10);
  } else {
    const limitIndex = args.indexOf('--limit');
    if (limitIndex !== -1 && args[limitIndex + 1]) {
      limit = parseInt(args[limitIndex + 1], 10);
    }
  }

  const dryRun = args.includes('--dry-run');

  enrich({ limit, dryRun })
    .then(() => {
      console.log('\n✨ Enrichment complete');
    })
    .catch((err) => {
      console.error('\n❌ Enrichment failed:', err);
      process.exit(1);
    });
}

// ---------------------------------------------------------------------------

export default enrich;
