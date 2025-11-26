# Scripts Directory

Production-grade agentic workflow for automated publication curation.

# BFSI Insights – Scripts

This directory contains the production-grade agentic ingestion pipeline for BFSI Insights.
It automates the collection, enrichment, classification and publication of BFSI-relevant content using a controlled taxonomy stored in Supabase.

The system is designed to be:
deterministic, auditable, taxonomy-driven, LLM-augmented, and fully static on the frontend.

⸻

# ⚠️ Known Technical Debt

## Duplicate Enrichment Logic

**Problem**: AI enrichment logic is duplicated between:

- `supabase/functions/process-url/index.ts` (Edge Function, Deno) - used for manual URL submissions
- `scripts/agents/enrich.mjs` (Script, Node.js) - used for batch enrichment

**Impact**:

- ~200 lines of duplicate code (OpenAI prompts, taxonomy loading, response parsing)
- Risk of inconsistent behavior if only one gets updated
- Different payload formats (unified as of 2025-11-26, but fragile)

**Current Mitigation**:

- Both now use consistent format: `industry_codes[]`, `topic_codes[]`, `persona_scores`
- Tests should validate format consistency

**Future Solution Options**:

1. **Publish shared package** - Extract to npm package, import in both Deno and Node
2. **Deno-compatible module** - Use JSR or npm with Deno compatibility
3. **Accept duplication** - Keep separate, enforce consistency via integration tests

**Note**:

- Edge Functions cannot generate thumbnails (no Playwright/browser automation), so `enrich.mjs` will always be needed for full enrichment with thumbnails.
- All taxonomies (industries, topics, roles, geographies, etc.) are loaded from Supabase tables, ensuring consistency.

⸻

# 1. Pipeline Overview

## Autonomous Pipeline (Runs Nightly)

┌────────────────────────────────────────────────────────────┐
│ 1. DISCOVERY (agents/discover.mjs) - OPERATIONAL ✅ │
│ • Scrapes RSS feeds from kb_source table │
│ • Currently active: 4/15 sources (McKinsey, Deloitte, │
│ BIS, arXiv) │
│ • Missing RSS feeds: 11 sources (BCG, Bain, PwC, EY, │
│ KPMG, FT, Economist, FD, ECB, Fed, SSRN) │
│ • Adds new publications to ingestion_queue │
│ • Status: pending │
│ • Runs: Nightly at 2 AM UTC via GitHub Actions │
└────────────────────────────────────────────────────────────┘
↓
┌────────────────────────────────────────────────────────────┐
│ 2. ENRICHMENT (agents/enrich.mjs) - OPERATIONAL ✅ │
│ • Extracts full article content │
│ • Generates short/medium/long summaries (UK English) │
│ • Auto-tags using **database taxonomies only** │
│ • Identifies vendors and organisations │
│ → upserts into ag_vendor and bfsi_organization │
│ • Generates thumbnails (Playwright) │
│ • Produces quality metrics │
│ • Updates ingestion_queue payload │
│ • Status: pending → enriched │
│ • Runs: Nightly at 2 AM UTC (limit 20/night) │
│ • Logs run/step/metric events │
└────────────────────────────────────────────────────────────┘
↓
┌────────────────────────────────────────────────────────────┐
│ 3. MANUAL REVIEW (Admin UI: /admin/review) │
│ • Human quality gate (prevents false positives) │
│ • Inspect summaries, taxonomy, thumbnail │
│ • Approve → Calls approve_from_queue() function │
│ → Inserts into kb_publication with status='published' │
│ • Reject → status='rejected' │
│ • Manual edits allowed prior to approval │
└────────────────────────────────────────────────────────────┘
↓
┌────────────────────────────────────────────────────────────┐
│ 4. WEBSITE AUTO-PUBLISH │
│ • Frontend queries kb_publication directly │
│ • No build step required (live from Supabase) │
│ • git push → Cloudflare Pages deploy │
└────────────────────────────────────────────────────────────┘

## Manual Ingestion (Optional)

┌────────────────────────────────────────────────────────────┐
│ FETCH QUEUE (agents/fetch-queue.mjs) - OPTIONAL │
│ • For manually added URLs in ingestion_queue │
│ • Normalizes URL, title, and minimal metadata │
│ • Use case: One-off important articles not in RSS │
│ • Then proceeds to step 2 (Enrichment) above │
└────────────────────────────────────────────────────────────┘

⸻

# 2. Directory Structure

## agents/ – Core Agentic Modules

### fetch-queue.mjs

Loads pending queue items and transforms them into normalised enrichment tasks.

node scripts/agents/fetch-queue.mjs --limit=3 --dry-run

### enrich.mjs

Full enrichment pipeline:
• content extraction
• summarisation (UK English)
• metadata extraction
• taxonomy-based tagging (US-English codes)
• vendor/organisation detection → automatic upsert
• screenshot generation (thumbnail)
• metrics + logs

node scripts/agents/enrich.mjs --limit=5 --dry-run

### lib/\*

Shared helper modules:
• taxonomy.mjs – loads taxonomy from DB (no hard-coded labels)
• extract.mjs – HTTP/HTML/PDF extraction
• agent-run.mjs – auditing + observability
• text.mjs – normalisation + cleaning

⸻

### utilities/

    •	generate-thumbnails.mjs – regenerate missing thumbnails
    •	check-links.mjs – check for broken external links
    •	test-rss-feeds.mjs – validate RSS feeds in kb_source
    •	debug-scraper.mjs – inspect page structure for scraping
    •	filename-helper.mjs – standardises filenames
    •	extract-pdf.py – PDF extraction

### testing/

    •	test-pipeline.mjs

Integration test for the end-to-end ingestion workflow.

### \_archive/

Retired scripts and one-time migrations.
Not used in production.

⸻

# 3. Taxonomy Architecture

All classifications are stored and controlled in Supabase.
The LLM may ONLY assign values that exist in these tables.

No taxonomy values are stored in code.

## Core controlled vocabularies

All curated taxonomies that the LLM is allowed to use:

bfsi_industry – Full BFSI industry hierarchy (multi-level)
bfsi_process – Process hierarchy (multi-level)
bfsi_topic – High-level topics (curated by you)
bfsi_geography – Regions and subregions
bfsi_role – Executive / Professional / Researcher

## Automatically expanding vocabularies

These tables grow automatically during enrichment:

ag_vendor – Vendors detected in publications (auto-upsert)
bfsi_organization – Financial institutions detected (auto-upsert)

⸻

# 4. Naming Conventions

## Prefixes

    •	kb_ → publications and sources
    •	kb_publication
    •	kb_source
    •	bfsi_ → BFSI taxonomies
    •	bfsi_industry
    •	bfsi_process
    •	bfsi_topic
    •	bfsi_geography
    •	bfsi_organization
    •	ag_ → agentic AI entities
    •	ag_vendor
    •	ag_use_case
    •	ag_capability
    •	ingestion_ → ingestion pipeline
    •	ingestion_queue
    •	ingestion_error (future)

All schema names use US English.

⸻

# 5. Language Policy (Strict)

Code, database, and tags → US English

Examples:
• organization
• behavior
• modeling
• bfsi_organization
• ag_vendor

Summaries and narrative text → UK English

Examples:
• “organisation”
• “behaviour”
• “modelling”

Prompts instruct:

“Use UK English for all summaries and narrative text.
Use the exact US-English slugs, codes and schema names retrieved from the database for all tags.”

This ensures:
• human-facing content is UK-English
• machine-facing metadata is stable and uniform

⸻

# 6. Common Workflows

## Daily

node scripts/agents/fetch-queue.mjs
node scripts/agents/enrich.mjs

# Then approve in Supabase UI

git push

## Weekly

npm run generate:thumbnails

## Monthly

npm run validate:publications
npm run check:links

⸻

# 7. Configuration

Required environment variables:

PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
OPENAI_API_KEY=...

All write operations use the service key.
The public website uses anon with strict RLS.

⸻

# 8. Troubleshooting

Nothing in queue
• ingestion_queue empty
• RLS issue
• wrong URL normalisation
• missing source configuration

Enrichment errors
• Playwright not installed (npx playwright install)
• OpenAI key invalid or rate-limited
• URL blocked or HTML extraction failed
• Taxonomy missing (agent will refuse to tag)

Website shows nothing
• Publication not yet approved
-Incorrect persona filter
• Empty role/industry sets in DB

⸻

# 9. Monitoring

The following tables capture full operational telemetry:
• agent_run
• agent_run_step
• agent_run_metric

This allows dashboards for:
• throughput
• success/failure rates
• taxonomy coverage
• enrichment time
• summarisation costs

⸻

# 10. Future Extensions

The pipeline is designed for future expansion without structural changes:
• Reactivate the Discovery Agent
• Nightly GitHub Actions
• Versioned publications
• Multi-agent reasoning (editor, validator)
• Semantic BFSI alignment across taxonomies
• Audit-grade provenance tracking
