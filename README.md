# BFSI Insights

Agentic AI insights for executives, professionals, and researchers in banking, financial services and insurance.

## 🚀 Project Structure

```
bfsi-insights/
├── .github/              # CI/CD workflows (nightly discovery, link checks)
├── e2e/                  # End-to-end tests (Playwright)
├── public/               # Static assets (favicons)
├── scripts/              # Utility scripts
│   ├── publishing/       # Publishing utilities
│   └── utilities/        # Link checker, RSS testing, etc.
├── services/
│   └── agent-api/        # 🤖 Agent API service (Express.js)
│       └── src/
│           ├── agents/   # Discovery, Filter, Summarize, Tag, Thumbnail
│           ├── lib/      # AgentRunner, scrapers
│           └── cli.js    # CLI for running agents
├── src/
│   ├── features/         # Feature components (publications, modal)
│   ├── layouts/          # Page layouts (Base.astro)
│   ├── lib/              # Supabase client, utilities
│   └── pages/            # Route pages + API endpoints
│       ├── admin/        # Admin UI (add, review)
│       └── api/          # API routes (build trigger)
├── supabase/
│   ├── functions/        # Edge Functions (process-url)
│   └── migrations/       # Database schema + functions
└── dist/                 # Build output (gitignored)
```

**Key directories:**

- `services/agent-api/` — Express.js service with AI agents for content processing
- `src/pages/` — Astro routes (static site + SSR admin pages)
- `src/pages/admin/` — Admin UI for adding URLs and reviewing content
- `supabase/functions/` — Edge Functions for instant URL processing
- `supabase/migrations/` — Database schema, taxonomies, views, and PL/pgSQL functions
- `e2e/` — Playwright end-to-end tests

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

### Development

| Command           | Action                                     |
| :---------------- | :----------------------------------------- |
| `npm install`     | Install dependencies                       |
| `npm run dev`     | Start local dev server at `localhost:4321` |
| `npm run build`   | Build production site to `./dist/`         |
| `npm run preview` | Preview build locally before deploying     |
| `npm run lint`    | Run ESLint on all files                    |

### Agent API (Content Processing)

```bash
# Install agent-api dependencies
cd services/agent-api && npm install

# Run agents via CLI
node services/agent-api/src/cli.js discovery              # Find new publications
node services/agent-api/src/cli.js discovery --limit=10   # Limit to 10 items
node services/agent-api/src/cli.js discovery --dry-run    # Preview only

node services/agent-api/src/cli.js enrich --limit=20      # Full pipeline (filter → summarize → tag → thumbnail)
node services/agent-api/src/cli.js filter --limit=10      # Run relevance filter only
node services/agent-api/src/cli.js summarize --limit=5    # Run summarizer only
node services/agent-api/src/cli.js tag --limit=5          # Run tagger only
node services/agent-api/src/cli.js thumbnail --limit=5    # Generate thumbnails only

# Or start as HTTP API server
node services/agent-api/src/index.js
# POST /api/agents/run/discovery
# POST /api/agents/run/filter
# POST /api/agents/run/summarize
# POST /api/agents/run/tag
# POST /api/agents/run/thumbnail
```

### Utilities

| Command               | Action                          |
| :-------------------- | :------------------------------ |
| `npm run check:links` | Check for broken external links |
| `npm run test:e2e`    | Run Playwright end-to-end tests |

## Architecture

### Agent Pipeline

The content processing pipeline runs through these stages:

```
┌──────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐    ┌──────────────┐
│   DISCOVERY  │ →  │    FILTER    │ →  │  SUMMARIZE  │ →  │     TAG      │ →  │  THUMBNAIL   │
│              │    │              │    │             │    │              │    │              │
│ RSS/Scraping │    │  Relevance   │    │ AI Summary  │    │  Taxonomy    │    │  Screenshot  │
│ BFSI filter  │    │  GPT-4o-mini │    │   GPT-4o    │    │ GPT-4o-mini  │    │  Playwright  │
└──────────────┘    └──────────────┘    └─────────────┘    └──────────────┘    └──────────────┘
     pending    →      filtered    →     summarized   →       tagged     →      enriched
```

**Database-Driven Configuration:**

- **BFSI Keywords**: Loaded from `bfsi_industry` and `bfsi_topic` table labels
- **Exclusion Patterns**: Configured in `prompt_versions` table (discovery-filter agent)
- **Agent Prompts**: Stored in `prompt_versions` table, version-controlled
- **Taxonomies**: Industries and topics managed via Supabase tables

### Content Ingestion Options

#### **Option 1: Manual URL Submission** (⚡ Instant)

```text
/admin/add → Edge Function → enriched → /admin/review → Approve → Published
```

1. Paste URL at `/admin/add`
2. Edge Function processes instantly (~10 seconds)
3. Review and approve at `/admin/review`
4. Click "Trigger Build" to deploy

#### **Option 2: Nightly Pipeline** (🌙 Automated)

```text
Discovery → Filter → Summarize → Tag → Thumbnail → Review → Approve → Published
```

Runs automatically at 2 AM UTC via GitHub Actions:

1. **Discovery**: Scrapes RSS feeds, filters by BFSI keywords
2. **Enrichment**: Runs filter → summarize → tag → thumbnail (limit 20/night)
3. **Review**: Human approves at `/admin/review`
4. **Deploy**: Click "Trigger Build" or push to git

### Quick Start

**Manual Submission:**

```bash
# 1. Add URL via Admin UI → /admin/add
# 2. Review and approve → /admin/review
# 3. Click "Trigger Build" button
```

**Run Agents Manually:**

```bash
# Full pipeline
node services/agent-api/src/cli.js discovery --limit=10
node services/agent-api/src/cli.js enrich --limit=20

# Or individual stages
node services/agent-api/src/cli.js filter --limit=10
node services/agent-api/src/cli.js summarize --limit=5
node services/agent-api/src/cli.js tag --limit=5
node services/agent-api/src/cli.js thumbnail --limit=5
```

### Taxonomy System

Publications are tagged with a **structured taxonomy** stored in Supabase:

| Table           | Examples                                                               |
| --------------- | ---------------------------------------------------------------------- |
| `bfsi_industry` | banking, retail-banking, payments, insurance, wealth-management        |
| `bfsi_topic`    | strategy-and-management, technology-and-data, regulatory-and-standards |
| `bfsi_role`     | executive, professional, researcher                                    |

**How It Works:**

1. AI agents load taxonomy from database (not hardcoded)
2. AI selects appropriate codes from available options
3. Junction tables store many-to-many relationships
4. View `kb_publication_pretty` flattens for frontend

### Thumbnail Generation

Thumbnails are generated via Playwright in the `thumbnail` agent:

```bash
node services/agent-api/src/cli.js thumbnail --limit=5
```

- Screenshots original article URL
- Hides cookie banners via CSS injection
- Uploads to Supabase Storage (`asset/thumbnails/`)
- Updates queue payload with public URL

## Environment Variables

```bash
# Supabase
PUBLIC_SUPABASE_URL=https://xxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...

# OpenAI (for AI agents)
OPENAI_API_KEY=sk-...

# Cloudflare (for deploy trigger)
CLOUDFLARE_DEPLOY_HOOK=https://api.cloudflare.com/...
```

## Tech Stack

- **Frontend**: Astro 5, TailwindCSS, TypeScript
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **AI Agents**: Express.js, OpenAI GPT-4o/4o-mini, Playwright
- **Deployment**: Cloudflare Pages (static + SSR hybrid)
- **CI/CD**: GitHub Actions (nightly discovery, link checks)
