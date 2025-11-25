# BFSI Insights

Agentic AI insights for executives and professionals in banking, financial services and insurance.

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders:

```
bfsi-insights/
├── .github/          # CI/CD workflows
├── .vscode/          # Editor configuration
├── public/           # Static assets (favicons, thumbnails)
├── schemas/          # JSON schemas for validation
├── scripts/          # Build and maintenance scripts
├── src/
│   ├── components/   # Reusable UI components
│   ├── data/         # Publication data (from Supabase)
│   ├── features/     # Feature-specific components
│   ├── layouts/      # Page layouts
│   ├── lib/          # Utility functions
│   ├── pages/        # Route pages (.astro files)
│   ├── shared/       # Shared utilities
│   ├── styles/       # Global styles
│   └── types/        # TypeScript type definitions
├── supabase/         # Database configuration (if used)
└── dist/             # Build output
```

**Key directories:**

- `src/pages/` — Astro looks for `.astro` or `.md` files here. Each page is exposed as a route based on its file name.
- `src/components/` and `src/features/` — Reusable Astro/React/Vue/Svelte/Preact components.
- `public/` — Static assets like images and favicons.
- `scripts/` — Build and maintenance utilities including discovery, enrichment, and thumbnail generation agents.

## Getting Started

### Feeds

- RSS: https://www.bfsiinsights.com/feed.xml
- Updates JSON (latest 20): https://www.bfsiinsights.com/updates.json

Add this to an RSS reader (Feedly/Reeder) or automate via Zapier/IFTTT. The JSON endpoint is ideal for lightweight clients and dashboards.

### Quality gates

- Link checker: runs nightly to detect broken external links in published publications.
- Lighthouse CI: enforces ≥95 for Performance, Accessibility, Best Practices, and SEO on `/` and `/publications`. Reports are uploaded as CI artifacts.

Local commands:

- `npm run check:links`
- `npm run build && npm run lhci`

## 🧞 Commands

| Command                                 | Action                                           |
| :-------------------------------------- | :----------------------------------------------- |
| `npm install`                           | Installs dependencies                            |
| `npm run dev`                           | Starts local dev server at `localhost:4321`      |
| `npm run build`                         | Build your production site to `./dist/`          |
| `npm run preview`                       | Preview your build locally, before deploying     |
| `npm run discover -- --limit=10`        | Run discovery agent (finds new publications)     |
| `npm run enrich -- --limit=5`           | Run enrichment agent (AI processing)             |
| `npm run generate:thumbnails`           | Generate missing thumbnails with Playwright      |
| `supabase functions deploy process-url` | Deploy Edge Function for instant URL processing  |
| `npm run astro ...`                     | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help`               | Get help using the Astro CLI                     |

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).

## Workflow Summary

### Content Ingestion Pipelines

#### **Option 1: Manual URL Submission** (⚡ Instant Processing)

```text
┌─────────────────────────────────────────────────────────────────┐
│ 1. SUBMIT URL (Admin UI at /admin/add)                         │
│    • Paste URL + optional notes                                │
│    • Edge Function triggers immediately (~10 seconds)          │
│    • Fetches content → AI enrichment → taxonomy tagging        │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. REVIEW (Admin UI at /admin/review)                          │
│    • Appears in review queue with status='enriched'            │
│    • Human approves or rejects                                 │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. PUBLISH                                                      │
│    • Database updated immediately (kb_publication)             │
│    • Website rebuilds on git push (Cloudflare Pages)           │
│    • Article appears ~2 minutes after approval + push          │
└─────────────────────────────────────────────────────────────────┘
```

#### **Option 2: Autonomous Nightly Pipeline** (✅ Operational for 4/15 sources)

```text
┌─────────────────────────────────────────────────────────────────┐
│ 1. DISCOVERY ✅ (Runs nightly at 2 AM UTC)                     │
│    • Scrapes RSS feeds from kb_source table                    │
│    • Active: 4/15 sources (McKinsey, Deloitte, BIS, arXiv)    │
│    • Adds to ingestion_queue with status='pending'             │
│    • Manual run: npm run discover                             │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. ENRICHMENT ✅ (Runs nightly, limit 20/night)                │
│    • AI extracts content, generates summaries (UK English)     │
│    • Tags with database taxonomy (loads from Supabase):        │
│      - Industries (banking, financial-services, insurance)     │
│      - Topics (strategy, technology, regulatory, etc.)         │
│      - Role (executive, professional, researcher)              │
│    • Status: pending → enriched                                │
│    • Manual run: npm run enrich                               │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. MANUAL REVIEW (Admin UI at /admin/review)                   │
│    • Human quality gate (prevents false positives)            │
│    • Review summaries, tags, taxonomy                          │
│    • Actions:                                                  │
│      - Approve → Inserts into kb_publication (published)      │
│      - Reject → Marks as rejected for learning                 │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. PUBLISH                                                      │
│    • Database updated immediately (kb_publication)             │
│    • Static site rebuilds on git push (Cloudflare Pages)       │
│    • Articles appear ~2 minutes after rebuild completes        │
└─────────────────────────────────────────────────────────────────┘
```

**Coverage Status:**

- ✅ McKinsey, Deloitte, BIS, arXiv (RSS operational)
- ❌ 11 sources missing RSS feeds (see scripts/README.md for details)

### Quick Start

**Option A: Manual URL Submission (Fastest)**

```bash
# 1. Add URL via Admin UI
# Open: https://bfsiinsights.com/admin/add
# Paste URL → Click "Add to Queue"
# Edge Function processes in ~10 seconds

# 2. Review and approve
# Open: https://bfsiinsights.com/admin/review
# Click "Approve" for quality publications

# 3. Generate thumbnail (if needed)
npm run generate:thumbnails -- --limit=1

# 4. Trigger deployment
git commit --allow-empty -m "rebuild for new article"
git push  # Cloudflare Pages auto-deploys in ~2 minutes
```

**Option B: Automated Nightly Pipeline**

```bash
# 1. Discover new publications (or wait for nightly run at 2 AM UTC)
npm run discover -- --limit=10

# 2. Enrich pending items (or wait for nightly run)
npm run enrich -- --limit=5

# 3. Review and approve via Admin UI
# Open: https://bfsiinsights.com/admin/review

# 4. Deploy (articles appear after rebuild)
git push  # Auto-deploys to Cloudflare Pages
```

**Nightly Automation:**

- Discovery runs at 2 AM UTC (GitHub Actions)
- Enrichment processes up to 20 items/night
- You only need to review and approve in admin UI

### Taxonomy System

Publications are tagged with a **structured taxonomy** stored in Supabase:

**Industries** (`bfsi_industry` table):

- `banking` (with subcategories: retail-banking, corporate-banking, lending, payments, etc.)
- `financial-services` (wealth-management, asset-management, private-equity, etc.)
- `insurance`

**Topics** (`bfsi_topic` table):

- `strategy-and-management`
- `ecosystem`
- `regulatory-and-standards`
- `technology-and-data`
- `methods-and-approaches`

**How It Works:**

1. **Edge Function** loads taxonomy from database on each enrichment
2. **AI** selects appropriate codes from the actual taxonomy (not freeform tags)
3. **Junction tables** store many-to-many relationships:
   - `kb_publication_bfsi_industry` (publication ↔ industries)
   - `kb_publication_bfsi_topic` (publication ↔ topics)
4. **View** (`kb_publication_pretty`) flattens relationships for frontend

Example enrichment output:

```json
{
  "industry_codes": ["financial-services"],
  "topic_codes": ["strategy-and-management", "technology-and-data"],
  "summary": {
    "short": "120-150 char summary",
    "medium": "250-300 char summary",
    "long": "500-600 char summary with key insights"
  },
  "persona_scores": {
    "executive": 0.8,
    "professional": 0.9,
    "researcher": 0.7
  }
}
```

### Thumbnail Generation

**Automated via Playwright:**

```bash
npm run generate:thumbnails -- --limit=5
```

- Screenshots original article URL (not BFSI Insights page)
- Handles cookie banners and popups automatically
- Waits for `networkidle` to capture dynamic content
- Saves to `public/thumbs/` (served by Astro)
- Updates `kb_publication.thumbnail` with path
- **Format**: `{slug}.png` (WebP conversion planned)

**Important**: Some sites (e.g., McKinsey) have anti-bot measures that may cause black images. These require manual handling or alternative thumbnail sources.
