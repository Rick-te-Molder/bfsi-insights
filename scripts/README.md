# Scripts Directory

Production-grade agentic workflow for automated resource curation.

## 🎯 Workflow Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. DISCOVERY AGENT (agents/discover.mjs)                       │
│    • Monitors RSS feeds (arXiv, McKinsey, BCG, etc.)           │
│    • Filters by keywords & relevance                            │
│    • Adds to ingestion_queue with status='pending'             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. ENRICHMENT AGENT (agents/enrich.mjs)                         │
│    • Extracts full content from URL                             │
│    • Generates summaries (short/medium/long) via GPT-4         │
│    • Auto-tags using taxonomy (industry, topic, role, etc.)    │
│    • Generates thumbnail via Playwright                         │
│    • Calculates quality score                                   │
│    • Updates ingestion_queue with enriched data                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. MANUAL APPROVAL (Supabase UI)                                │
│    • Admin reviews complete card with thumbnail                 │
│    • Verifies summaries, tags, quality score                    │
│    • Actions:                                                   │
│      - Approve: INSERT into kb_resource (status='published')   │
│      - Reject: UPDATE ingestion_queue (status='rejected')      │
│      - Edit: Manual refinements before approval                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. PUBLISHING WORKFLOW                                          │
│    • npm run build:resources (generates resources.json)        │
│    • npm run build (static site generation)                    │
│    • git push (deploy to Cloudflare Pages)                     │
└─────────────────────────────────────────────────────────────────┘
```

## 📁 Directory Structure

### `agents/`

Core agentic scripts that power the automated workflow.

- **`discover.mjs`** - Discovery Agent
  - Monitors multiple sources (RSS, APIs)
  - Keyword filtering & relevance scoring
  - Deduplication against existing resources
  - Usage: `node scripts/agents/discover.mjs [--source=arxiv] [--dry-run]`

- **`enrich.mjs`** - Enrichment Agent
  - Content extraction & summarization
  - Taxonomy-based auto-tagging
  - Thumbnail generation
  - Quality scoring
  - Usage: `node scripts/agents/enrich.mjs [--limit=5] [--dry-run]`

### `publishing/`

Scripts for building and deploying the site.

- **`build-resources.mjs`** - Builds `resources.json` from Supabase
  - Fetches published resources from `kb_resource` table
  - Applies schema transformations
  - Validates taxonomy values
  - Usage: `npm run build:resources`

- **`validate-resources.mjs`** - Validates resource data
  - Schema validation
  - Required field checks
  - Taxonomy value validation
  - Usage: `npm run validate:resources`

### `utilities/`

Supporting utilities for maintenance and operations.

- **`generate-thumbnails.mjs`** - Generate missing thumbnails
  - Scans for resources without local thumbnails
  - Uses Playwright to capture screenshots
  - Usage: `npm run generate:thumbnails`

- **`check-links.mjs`** - Validate resource URLs
  - Checks for broken links
  - Reports HTTP errors
  - Usage: `npm run check:links`

- **`generate-notes.mjs`** - Generate release notes
  - Usage: `npm run notes`

- **`lint-items-no-time.mjs`** - Lint resource files
  - Usage: `npm run lint:items`

- **`filename-helper.mjs`** - Filename utilities
  - Helps with consistent naming

- **`extract-pdf.py`** - PDF content extraction
  - Extracts text from PDF documents

### `testing/`

Integration and end-to-end tests.

- **`test-pipeline.mjs`** - Integration tests
  - Tests complete workflow
  - Database migrations
  - Agent functionality
  - Usage: `node scripts/testing/test-pipeline.mjs`

### `_archive/`

Historical scripts and one-time migrations. Not used in production.

## 🚀 Common Workflows

### Daily: Run Discovery & Enrichment

```bash
# Discover new resources
node scripts/agents/discover.mjs

# Enrich pending resources
node scripts/agents/enrich.mjs

# Review in Supabase UI, approve/reject
# Then publish:
npm run build:resources
npm run build
git push
```

### Weekly: Generate Missing Thumbnails

```bash
npm run generate:thumbnails
npm run build:resources
npm run build
```

### Monthly: Validate & Check Links

```bash
npm run validate:resources
npm run check:links
```

## 🔧 Configuration

### Required Environment Variables

```bash
PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=xxx
OPENAI_API_KEY=sk-xxx
```

### Discovery Sources

Configured in `agents/discover.mjs`:

- arXiv AI/ML/Finance
- McKinsey Insights
- BCG Publications
- Deloitte Insights
- (Add more in `SOURCES` object)

### Taxonomy

Managed in Supabase tables:

- `bfsi_role` - Target roles (executive, professional, researcher)
- `bfsi_industry` - Industries (banking, insurance, fintech, etc.)
- `bfsi_topic` - Topics (AI, data, risk, customer-experience, etc.)
- `bfsi_use_case` - Use cases (fraud-detection, credit-scoring, etc.)
- `bfsi_agentic_capability` - Capabilities (reasoning, planning, tool-use, etc.)
- `bfsi_geography` - Regions (global, north-america, europe, etc.)

## 📊 Quality Gates

All agents include quality checks:

1. **Discovery**: Keyword relevance, source reputation
2. **Enrichment**: Content length, summary quality, taxonomy coverage
3. **Validation**: Schema compliance, required fields
4. **Publishing**: Build success, link validity

## 🧹 Maintenance

### Archive Old Scripts

Moved to `_archive/` when no longer needed in production.

### Update Taxonomy

Edit Supabase tables directly - agents will pick up changes automatically.

### Monitor Performance

- Discovery: Check `ingestion_queue` growth rate
- Enrichment: Monitor OpenAI API usage
- Publishing: Check build times

## 🆘 Troubleshooting

### Discovery finds nothing

- Check RSS feed URLs are accessible
- Verify keywords in `SOURCES` configuration
- Check Supabase connection

### Enrichment fails

- Verify OpenAI API key
- Check rate limits
- Ensure Playwright is installed: `npx playwright install`

### Build fails

- Run `npm run validate:resources`
- Check Supabase connection
- Verify all published resources have required fields

## 📚 Further Reading

- [Supabase Dashboard](https://supabase.com/dashboard)
- [Astro Documentation](https://docs.astro.build)
- [Playwright Documentation](https://playwright.dev)
