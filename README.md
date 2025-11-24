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

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).

## Workflow Summary

### Content Ingestion Pipeline

**Autonomous Nightly Pipeline** (✅ Operational for 4/15 sources)

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
│    • Tags with controlled taxonomy (US English slugs):         │
│      - role, industry, topic, content_type, geography          │
│      - use_cases, agentic_capabilities                         │
│    • Detects vendors & organizations (auto-upsert)             │
│    • Generates thumbnails (Playwright)                         │
│    • Status: pending → enriched                                │
│    • Manual run: npm run enrich                               │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. MANUAL REVIEW (Admin UI at /admin/review)                   │
│    • Human quality gate (prevents false positives)            │
│    • Review summaries, tags, thumbnail                         │
│    • Actions:                                                  │
│      - Approve → Inserts into kb_publication (published)      │
│      - Reject → Marks as rejected for learning                 │
│      - Edit → Manual refinements before approval              │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. AUTO-PUBLISH (No manual step)                               │
│    • Website queries kb_publication directly (Supabase)        │
│    • Publications appear immediately after approval            │
│    • Deployment: git push → Cloudflare Pages                  │
└─────────────────────────────────────────────────────────────────┘
```

**Coverage Status:**

- ✅ McKinsey, Deloitte, BIS, arXiv (RSS operational)
- ❌ 11 sources missing RSS feeds (see scripts/README.md for details)

### Quick Start

**For Manual Testing:**

```bash
# 1. Discover new publications (or wait for nightly run)
npm run discover -- --limit=10

# 2. Enrich pending items (or wait for nightly run)
npm run enrich -- --limit=5

# 3. Review and approve
# Open: https://your-domain.com/admin/review
# Click "Approve" for quality publications

# 4. Publications appear immediately on site
# (No manual publish step needed)

# 5. Deploy code changes
npm run build
git push  # Auto-deploys to Cloudflare Pages
```

**Nightly Automation:**

- Discovery runs at 2 AM UTC (GitHub Actions)
- Enrichment processes up to 20 items/night
- You only need to review and approve in admin UI

### Multi-Value Dimension Support

Publications can now have **multiple** industries, topics, vendors, and organizations:

- **Junction Tables**: Normalized many-to-many relationships
- **Backward Compatible**: View returns both scalar (primary) and array (all) values
- **Auto-Creation**: Vendors and organizations are auto-created when mentioned

Example enrichment output:

```json
{
  "tags": {
    "role": "researcher",
    "industry": ["banking", "insurance"],
    "topic": ["ai", "risk", "compliance"]
  },
  "vendors": ["OpenAI", "Anthropic"],
  "organizations": ["JPMorgan", "Goldman Sachs"]
}
```
