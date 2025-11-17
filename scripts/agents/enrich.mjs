#!/usr/bin/env node
/**
 * Enrichment Agent - Generates summaries, tags, and thumbnails using full taxonomies from database
 *
 * Usage:
 *   node scripts/enrich.mjs              # Enrich all pending
 *   node scripts/enrich.mjs --limit=5    # Limit to 5 items
 *   node scripts/enrich.mjs --dry-run    # Preview only
 *
 * Requires: OPENAI_API_KEY, Playwright installed
 * Schema: Pulls taxonomy values from bfsi_industry, bfsi_topic tables
 */

import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const THUMBS_DIR = path.join(__dirname, '../public/thumbs');

// Cache for taxonomy values
let TAXONOMIES = null;

function calculateQualityScore(item, enrichment) {
  // Source reputation weights
  const sourceReputation = {
    McKinsey: 1.0,
    'Boston Consulting Group': 1.0,
    'Deloitte Insights': 0.95,
    'Federal Reserve': 1.0,
    'Bank for International Settlements': 1.0,
    Gartner: 0.9,
    arXiv: 0.7,
  };

  // Content type weights
  const contentTypeWeight = {
    'peer-reviewed-paper': 0.95,
    'white-paper': 0.9,
    report: 0.9,
    'policy-document': 0.95,
    article: 0.7,
    presentation: 0.6,
    webinar: 0.5,
    dataset: 0.6,
    website: 0.5,
  };

  // Recency (items < 30 days get full weight)
  const publishedDate = new Date(item.payload.published_at || item.discovered_at);
  const ageInDays = (Date.now() - publishedDate.getTime()) / (1000 * 60 * 60 * 24);
  const recencyScore = ageInDays < 30 ? 1.0 : ageInDays < 90 ? 0.9 : ageInDays < 180 ? 0.8 : 0.7;

  // Relevance confidence from LLM
  const relevanceConfidence = enrichment.relevance_confidence || 0.5;

  // Calculate weighted score
  const sourceScore = sourceReputation[item.payload.source] || 0.6;
  const typeScore = contentTypeWeight[enrichment.tags.content_type] || 0.6;

  const qualityScore =
    sourceScore * 0.35 + typeScore * 0.2 + recencyScore * 0.15 + relevanceConfidence * 0.3;

  return Math.round(qualityScore * 100) / 100; // Round to 2 decimals
}

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

  // Fetch valid roles from ref_role table
  const { data: rolesData, error: rolesError } = await supabase
    .from('ref_role')
    .select('value')
    .order('sort_order');

  if (rolesError) {
    console.error('Error fetching roles:', rolesError);
    process.exit(1);
  }

  TAXONOMIES = {
    role: rolesData.map((r) => r.value),
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

      // Auto-reject if not BFSI relevant (PDCA improvement)
      if (enrichment.bfsi_relevant === false) {
        console.log(`   ⚠️  Not BFSI relevant: ${enrichment.relevance_reason}`);
        if (!dryRun) {
          const { error: rejectError } = await supabase
            .from('ingestion_queue')
            .update({
              status: 'rejected',
              rejection_reason: `Auto-rejected: ${enrichment.relevance_reason}`,
              reviewed_at: new Date().toISOString(),
            })
            .eq('id', item.id);

          if (rejectError) {
            console.error(`   ❌ Failed to reject: ${rejectError.message}`);
          } else {
            console.log(`   ✖️  Auto-rejected`);
          }
        }
        continue;
      }

      if (!dryRun) {
        // Store enrichment with metadata
        const enrichedPayload = {
          ...item.payload,
          summary: enrichment.summary,
          tags: enrichment.tags,
          persona_scores: enrichment.persona_scores,
          quality_score: calculateQualityScore(item, enrichment),
          relevance_confidence: enrichment.relevance_confidence,
        };

        // Generate local thumbnail using Playwright
        console.log('   📸 Generating thumbnail...');
        const thumbnailPath = await generateThumbnail(item);
        const thumbnailUrl = thumbnailPath || null;

        const { error: updateError } = await supabase
          .from('ingestion_queue')
          .update({
            payload: enrichedPayload,
            thumb_ref: thumbnailUrl,
            prompt_version: 'v3.0-bfsi-filter',
            model_id: 'gpt-4o-mini',
          })
          .eq('id', item.id);

        if (updateError) {
          console.error(`   ❌ Failed to update: ${updateError.message}`);
        } else {
          console.log(
            `   ✅ ${enrichment.tags.role} | ${enrichment.tags.industry} | ${enrichment.tags.topic}`,
          );
        }
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

// TODO: Add Editor Agent for quality validation
// async function editorReview(item, enrichment) { ... }

async function generateThumbnail(item) {
  // Check if thumbnail already exists
  const slug =
    item.payload.slug ||
    item.url
      .split('/')
      .pop()
      .replace(/[^a-z0-9-]/gi, '-')
      .toLowerCase();
  const localPaths = [
    path.join(THUMBS_DIR, `${slug}.png`),
    path.join(THUMBS_DIR, `${slug}.webp`),
    path.join(THUMBS_DIR, `${slug}.jpg`),
  ];

  const existingPath = localPaths.find((p) => fs.existsSync(p));
  if (existingPath) {
    const basename = path.basename(existingPath);
    console.log(`   ✓ Thumbnail exists: ${basename}`);
    return `/thumbs/${basename}`;
  }

  // Generate new thumbnail
  try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1200, height: 675 },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();
    await page.goto(item.url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await page.waitForTimeout(2000);

    // Hide cookie banners
    await page.addStyleTag({
      content: `
        [class*="cookie"],
        [id*="cookie"],
        [class*="consent"],
        [class*="banner"],
        .onetrust-pc-dark-filter,
        #onetrust-consent-sdk {
          display: none !important;
        }
      `,
    });

    await page.waitForTimeout(500);

    const screenshotPath = path.join(THUMBS_DIR, `${slug}.png`);
    await page.screenshot({
      path: screenshotPath,
      type: 'png',
      fullPage: false,
    });

    await browser.close();

    console.log(`   ✓ Generated: ${slug}.png`);
    return `/thumbs/${slug}.png`;
  } catch (error) {
    console.log(`   ⚠️  Thumbnail failed: ${error.message}`);
    return null;
  }
}

async function generateEnrichment(content, title) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');

  const taxonomies = await loadTaxonomies();

  const prompt = `You are a BFSI AI analyst. Analyze this resource and return ONLY valid JSON.

CRITICAL BFSI RELEVANCE CHECK:

Title: ${title}
Content: ${content}

This content is ONLY relevant if it meets ONE of these criteria:

1. PRIMARY FOCUS: Main topic is banking, insurance, or financial services
   ✓ Examples: "AI for credit scoring", "LLMs in banking", "Fraud detection in payments"
   ✗ Counter: "AI in education with example of student loans"

2. DIRECT APPLICATION: Technology/method with clear, specific BFSI use case
   ✓ Examples: "RAG for contract analysis" (BFSI uses contracts), "Multi-agent systems for trading"
   ✗ Counter: "RAG systems" (generic, no BFSI context)

3. REGULATORY/INDUSTRY: BFSI regulations, industry reports, standards
   ✓ Examples: "Basel III implementation", "GDPR for banks", "ISO 20022 adoption"

NOT RELEVANT if:
- BFSI mentioned only as passing example
- "Finance" means funding/budgeting, not financial services
- Healthcare, education, retail, etc. as primary domain
- Generic AI/tech with no BFSI context

Return JSON with this EXACT structure. Each tag field must contain EXACTLY ONE string value (no pipes, no arrays, no multiple values):

{
  "bfsi_relevant": true or false,
  "relevance_confidence": 0.0-1.0 (0.9+ = very confident, 0.5-0.8 = uncertain, <0.5 = likely not relevant),
  "primary_domain": "banking|insurance|fintech|payments|wealth-management|healthcare|education|manufacturing|other",
  "relevance_reason": "2-3 sentence explanation with specific BFSI connections or why it's not relevant",

{
  "summary": {
    "short": "120-240 characters - Lead with KEY FINDING or MAIN CLAIM. Use concrete numbers/metrics if available. NO 'This paper presents...' language. Format: '[Key Insight]. [Supporting detail].'",
    "medium": "240-480 characters - Elaborate on HOW and WHY. Include methodology or approach. Add 1-2 specific examples. Connect to BFSI practitioner concerns.",
    "long": "640-1120 characters - Deep dive into implications for BFSI. Include limitations or caveats. Suggest actionable next steps. Compare to existing approaches. Note any regulatory considerations."
  },
  "persona_scores": {
    "executive": 0.0-1.0 (strategic relevance, regulatory impact, market shifts, transformation themes),
    "professional": 0.0-1.0 (operational guidance, technical content, implementation specifics),
    "researcher": 0.0-1.0 (formal methods, empirical results, theory, peer-reviewed rigor)
  },
  "tags": {
    "role": "<pick ONE from: ${taxonomies.role.join(', ')}>",
    "industry": "<pick ONE most specific from: ${taxonomies.industry.slice(0, 10).join(', ')}...>",
    "topic": "<pick ONE most specific from: ${taxonomies.topic.slice(0, 10).join(', ')}...>",
    "content_type": "<pick ONE from: ${taxonomies.content_type.join(', ')}>",
    "geography": "<pick ONE from: ${taxonomies.geography.join(', ')}>",
    "use_cases": "<pick ONE from: ${taxonomies.use_cases.join(', ')}>",
    "agentic_capabilities": "<pick ONE from: ${taxonomies.agentic_capabilities.join(', ')}>"
  }
}

CRITICAL RULES:
1. Each tag field = SINGLE STRING VALUE ONLY (e.g., "researcher", NOT "researcher|executive")
2. NO pipes (|), NO commas in tag values, NO arrays
3. Use most specific hierarchical value available
4. Geography: "global" for worldwide content, specific region if focused
5. All lowercase, hyphenated format

SUMMARY EXAMPLES:

BAD (generic description):
"This paper explores the use of AI in banking and presents a framework for implementation."

GOOD (specific insight):
"Shows 43% cost reduction in customer service using 3-agent LLM workflow. Key: agent coordination reduces hallucinations by 67%."

BAD (vague):
"The report discusses digital transformation in financial services."

GOOD (actionable):
"Banks adopting API-first architecture see 3x faster product launches. Critical success factor: legacy system integration strategy."

Focus on: WHAT was found, HOW MUCH impact, WHY it matters to BFSI practitioners.`;

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
  const result = JSON.parse(data.choices[0].message.content);

  // Validate: reject if any tag contains pipes (multiple values)
  const tags = result.tags || {};
  for (const [key, value] of Object.entries(tags)) {
    if (typeof value === 'string' && value.includes('|')) {
      throw new Error(
        `Invalid tag ${key}: contains multiple values "${value}". Expected single value.`,
      );
    }
  }

  return result;
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
