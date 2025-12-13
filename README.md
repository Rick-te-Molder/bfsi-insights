# BFSI Insights

> Agentic AI insights for executives, professionals, and researchers in banking, financial services, and insurance.

A static-plus-agentic platform combining Astro, Supabase, Express-based agents, nightly pipelines, and an admin UI for real-time content ingestion and publication.

---

## 1. Overview

### 1.1 Purpose

BFSI Insights collects, enriches, classifies, and publishes high-quality AI-related insights for the banking, financial-services, and insurance industries. It automates discovery while maintaining editorial review and high data quality.

### 1.2 Target Audience

- **Executives** — C-suite, senior consultants, strategy advisors in BFSI
- **Functional Specialists** — Risk, compliance, operations, product managers
- **Engineers** — Developers, architects, data scientists building BFSI solutions
- **Researchers** — Academics, analysts tracking AI/fintech developments

### 1.3 Key Features

- Agentic and manual content ingestion
- AI-based filtering, summarization, tagging, and thumbnail generation
- Guardrail taxonomies (industry, topics, AI use cases, regulations)
- Expandable taxonomies (organizations, vendors)
- Admin UI for reviewing, approving, and publishing
- Supabase-based data with RLS-secured admin functions
- GitHub Actions nightly ingestion & link checking

### 1.4 High-Level Workflow

```
Entry:      Manual (queued) or Nightly (pending → filtered)
                            ↓
Pipeline:   summarized → tagged → thumbnailed → enriched
                            ↓
Review:     👤 Approve article + suggested taxonomy entries → Published
            👤 Reject  → Rejected
```

> **Taxonomy curation:** During review, the admin sees AI-suggested vendors and organizations. Approving the article also upserts approved suggestions to `ag_vendor` and `bfsi_organization` tables.

---

## 3. Functional Description

### 3.1 What the App Does

- Collects and enriches BFSI-related content from RSS feeds, sitemaps, academic papers, and manual submissions
- Classifies with strict guardrail taxonomies
- Maintains expandable vendor/organization taxonomies
- Publishes curated insights to a fast, static site

### 3.2 Publication Lifecycle

```
queued → processing → enriched → approved → published
```

### 3.3 Roles

| Role             | Capabilities                                   |
| ---------------- | ---------------------------------------------- |
| **Public users** | Read publications, search, filter              |
| **Admins**       | Ingest URLs, review, approve, trigger rebuilds |

### 3.4 Supported Use Cases

- Executive tracking of BFSI AI developments
- Research monitoring
- Internal regulatory intelligence
- Vendor benchmarking and analysis

---

## 4. System Architecture

### 4.1 Components

The system has five main components:

| Component      | Role                             | Tech               | Hosting    |
| -------------- | -------------------------------- | ------------------ | ---------- |
| **Database**   | Guardrails, SOR, config, storage | Postgres + Storage | Supabase   |
| **Agent API**  | Discover, filter, summarize, tag | Node.js/Express    | Render     |
| **Website**    | Browse, search, read             | Astro + Tailwind   | Cloudflare |
| **Admin**      | Review, approve, ingest          | Next.js 15         | Vercel     |
| **Automation** | Nightly jobs, tests, CI          | GitHub Actions     | GitHub     |

### 4.2 Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│  APPLICATION LAYER                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Website    │  │    Admin     │  │  Agent API   │          │
│  │  (public)    │  │  (internal)  │  │  (pipeline)  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
├─────────────────────────────────────────────────────────────────┤
│  DATA LAYER                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Publications │  │  Taxonomies  │  │    Config    │          │
│  │   (SOR)      │  │ (guardrails) │  │  (prompts)   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
├─────────────────────────────────────────────────────────────────┤
│  INFRASTRUCTURE LAYER                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Supabase   │  │  Cloudflare  │  │    Render    │          │
│  │  (DB + Auth) │  │   (CDN)      │  │   (Agents)   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Build & Deploy Flow

1. Admin approves publication in `/admin/review`
2. Admin triggers build (button or git push)
3. Astro rebuilds static site
4. Cloudflare Pages deploys to CDN

### 4.4 Detailed Diagrams

For detailed architecture diagrams, see:

- [`docs/architecture/overview.md`](docs/architecture/overview.md) — System overview (Mermaid)
- [`docs/bpmn/process-diagrams.md`](docs/bpmn/process-diagrams.md) — BPMN ingestion flow
- [`docs/dfd/data-flows.md`](docs/dfd/data-flows.md) — Data flow diagram
- [`docs/data-model/schema.md`](docs/data-model/schema.md) — ER diagram

---

## 5. Agent Pipeline

### 5.1 AI Agents

```
Agent                Purpose                              Model/Tool
─────────────────────────────────────────────────────────────────────────
discoverer.js        Find candidates from RSS/sitemaps    —
scorer.js            Score relevance per audience         GPT-4o-mini
content-fetcher.js   Fetch page content (HTML/PDF)        Playwright
screener.js          Second-pass BFSI relevance filter    GPT-4o-mini
summarizer.js        Generate summaries (short/med/long)  Claude Sonnet 4
tagger.js            Classify with taxonomies             GPT-4o
thumbnailer.js       Screenshot article for preview       Playwright
enricher.js          Orchestrate enrichment pipeline      —
```

**Discovery modes:**

- `--agentic` — LLM scores relevance (default in nightly workflow)
- `--hybrid` — Embeddings pre-filter + LLM for uncertain cases
- _(no flag)_ — Rule-based keyword matching (fast but noisy)

### 5.2 Pipeline Processes

#### Process 1: Discovery (nightly)

Finds new content from RSS feeds and sitemaps.

| Step              | Agent/Tool                | Status After | Description               |
| ----------------- | ------------------------- | ------------ | ------------------------- |
| RSS/Sitemap fetch | `discoverer.js`           | —            | Parse feeds, extract URLs |
| Relevance scoring | `scorer.js` (GPT-4o-mini) | `pending`    | Score 1-10 per audience   |

#### Process 2: Enrichment (automated)

Orchestrated by `enricher.js`. Runs on `pending_enrichment` items.

| Step             | Agent/Tool                                       | Status After              | Description                          |
| ---------------- | ------------------------------------------------ | ------------------------- | ------------------------------------ |
| Start processing | —                                                | `processing`              | Lock item                            |
| Content fetch    | `content-fetcher.js` (Playwright for some sites) | `fetched`                 | Download page, extract text          |
| Relevance filter | `screener.js` (GPT-4o-mini)                      | `filtered` or `rejected`¹ | Verify BFSI relevance                |
| Summarization    | `summarizer.js` (Claude Sonnet 4)                | `summarized`              | Generate short/medium/long summaries |
| Tagging          | `tagger.js` (GPT-4o)                             | `tagged`                  | Classify with taxonomies             |
| Thumbnail        | `thumbnailer.js` (Playwright)                    | `enriched`                | Screenshot article                   |

> ¹ Filter rejection only applies to nightly discovery. Manual submissions skip rejection.

#### Process 3: Review (human)

Human reviews enriched items in admin UI.

| Action    | Status After | Description                |
| --------- | ------------ | -------------------------- |
| Approve   | `approved`   | Item ready for publishing  |
| Reject    | `rejected`   | Item discarded with reason |
| Re-enrich | `queued`     | Re-run enrichment pipeline |

#### Process 4: Publishing (human trigger)

| Step          | Actor | Description                          |
| ------------- | ----- | ------------------------------------ |
| Approve       | 👤    | Moves item to `kb_publication` table |
| Trigger Build | 👤    | Deploys to Cloudflare via webhook    |

#### Status Reference

See `docs/architecture/pipeline-status-codes.md` for full status code documentation.

### 5.3 Content Ingestion

**Manual:** `/admin/add` → auto-enriched → `/admin/review` → Approve → Published

**Nightly (2 AM UTC):** Discovery → Enrichment (limit 20) → Human Review → Deploy

### 5.4 Running the Pipeline

```bash
node services/agent-api/src/cli.js discovery --limit=10
node services/agent-api/src/cli.js enrich --limit=20
```

### 5.5 Agent Evaluation

See `docs/agents/manifest.yaml` for agent registry and `docs/issues/kb-207-best-in-class-prompt-engineering.md` for eval framework details.

---

## 6. Data Model & Taxonomy

### 6.1 Core Tables

| Table                   | Purpose                     |
| ----------------------- | --------------------------- |
| `kb_publication`        | Main publication data       |
| `kb_publication_pretty` | Flattened view for frontend |
| `ingestion_queue`       | Processing pipeline queue   |
| `kb_source`             | RSS feed sources            |
| `prompt_version`        | Versioned AI prompts        |

### 6.2 Tables Used by Agents

| Table                    | Type       | Used By        | Purpose                                          |
| ------------------------ | ---------- | -------------- | ------------------------------------------------ |
| **Core Pipeline**        |            |                |                                                  |
| `ingestion_queue`        | Core       | All agents     | Processing pipeline queue                        |
| `kb_publication`         | Core       | summarize, tag | Final published articles                         |
| `kb_source`              | Core       | discover       | RSS feed sources configuration                   |
| `prompt_version`         | Core       | All agents     | Versioned AI prompts                             |
| `writing_rules`          | Core       | summarize      | Editorial guidelines for summaries               |
| **Guardrail Taxonomies** |            |                | _LLM picks from list, cannot create new entries_ |
| `bfsi_industry`          | Guardrail  | discover, tag  | 53 BFSI sectors (banking, insurance, etc.)       |
| `bfsi_topic`             | Guardrail  | discover, tag  | 5 content categories (strategy, tech, etc.)      |
| `kb_geography`           | Guardrail  | tag            | 30 regions/countries (global, eu, uk, gcc, etc.) |
| `bfsi_process_taxonomy`  | Guardrail  | tag            | Business processes (claims, underwriting, etc.)  |
| `ag_use_case`            | Guardrail  | tag            | 16 AI use cases (fraud-detection, etc.)          |
| `ag_capability`          | Guardrail  | tag            | 24 AI capabilities (nlp, vision, etc.)           |
| **Expandable Entities**  |            |                | _LLM extracts names, may create new entries_     |
| `ag_vendor`              | Expandable | tag            | AI/tech vendors mentioned in articles            |
| `bfsi_organization`      | Expandable | tag            | Banks, insurers, asset managers mentioned        |
| `regulator`              | Expandable | tag            | Regulatory bodies (ecb, fca, sec, etc.)          |
| `regulation`             | Expandable | tag            | Regulations/laws (gdpr, psd2, dora, etc.)        |
| `obligation`             | Expandable | tag            | Compliance requirements per regulation           |
| `standard_setter`        | Expandable | tag            | Standards bodies (iso, nist, etc.)               |
| `standard`               | Expandable | tag            | Industry standards (iso-27001, nist-csf, etc.)   |
| **Reference Data**       |            |                |                                                  |
| `classic_papers`         | Reference  | discover       | Academic papers reference list                   |

#### Regulatory Compliance Feature

The regulatory tables form a hierarchy: **Regulator → Regulation → Obligation**.

```
Example: ECB (regulator) → DORA (regulation) → "ICT risk assessment" (obligation)
```

**Current state:** The tag agent extracts `regulator_codes`, `regulation_codes`, and `obligation_codes` from articles, linking publications to specific compliance requirements.

**Features:**

- Browse publications by regulatory impact
- Track which obligations are covered by AI solutions
- Filter content by compliance area (risk, reporting, security, etc.)

> **Note:** Expandable entities (vendors, organizations, regulators, etc.) grow as articles mention new names. Guardrail taxonomies (industries, topics, geographies) are curated to ensure consistent classification.

---

## 7. Admin Workflows

The admin UI (`admin-next/`) is a Next.js 15 app with:

- **Dashboard** — Pipeline stats, issues alerts, quick actions
- **Review Queue** — Master-detail layout with keyboard shortcuts (↑↓ navigate, a/r/e actions)
- **Sources** — Health indicators (🟢🟡🔴⚪), discovery stats, last run times
- **Prompts** — Version history, test playground, stage badges (Live/Staged/Draft)
- **Golden Sets** — Curated test cases for prompt evaluation
- **A/B Tests** — Compare prompt versions side-by-side

### 7.1 Submit a URL

`/admin/add` → queued → auto-processed → review

### 7.2 Review & Approve

`/admin/review` — Split view (list + detail panel) or list view with bulk actions.

### 7.3 Trigger Deployment

Sidebar "Trigger Build" button or push to `main`.

---

## 8. Getting Started

### 8.1 Prerequisites

- Node.js 20+
- Supabase project
- Cloudflare account
- OpenAI API key

### 8.2 Local Setup

```bash
# Frontend
npm install
npm run dev

# Agent API
cd services/agent-api
npm install
node src/index.js
```

---

## 9. Commands

### 9.1 Frontend Commands

| Command           | Action                                     |
| ----------------- | ------------------------------------------ |
| `npm install`     | Install dependencies                       |
| `npm run dev`     | Start local dev server at `localhost:4321` |
| `npm run build`   | Build production site to `./dist/`         |
| `npm run preview` | Preview build locally before deploying     |
| `npm run lint`    | Run ESLint on all files                    |

### 9.2 Agent CLI Commands

```bash
node services/agent-api/src/cli.js discovery --agentic --limit=10
node services/agent-api/src/cli.js enrich --limit=20
node services/agent-api/src/cli.js filter|summarize|tag|thumbnail --limit=5
node services/agent-api/src/cli.js eval --agent=screener --type=golden
```

### 9.3 Utility & Maintenance

```bash
npm run check:links                                      # Check broken links
node services/agent-api/src/scripts/backfill-*.js --dry-run  # Backfill scripts
```

---

## 10. Testing & Quality

### 10.1 Test Layers

| Level           | Tool                        | Tests | Target         |
| --------------- | --------------------------- | ----- | -------------- |
| **Unit**        | Vitest                      | 68    | ≥80% cov       |
| **Integration** | Lighthouse CI, Link Checker | 4     | ≥95 score      |
| **E2E**         | Playwright                  | 28    | Critical paths |

```bash
npm run test              # Unit tests
npm run test -- --coverage
npx playwright test       # E2E tests
npm run check:links       # Link checker
```

### 10.2 Code Quality

- **Linting**: ESLint + Prettier (enforced via Husky pre-commit)
- **SonarCloud**: Runs on every PR — checks bugs, vulnerabilities, coverage
- **Lighthouse CI**: Enforces ≥95 for Performance, A11y, SEO on `/` and `/publications`

See [docs/quality/sonar-exclusions.md](docs/quality/sonar-exclusions.md) for coverage policy.

---

## 11. Security

See [SECURITY.md](SECURITY.md) for policies and vulnerability reporting.

- **Auth**: Supabase Auth for admin users
- **RLS**: All tables protected; RPCs verify admin status
- **Secrets**: Supabase Vault; no service keys in frontend

---

## 12. Environment Variables

### Frontend (.env)

```bash
PUBLIC_SUPABASE_URL=https://xxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### Agent API (services/agent-api/.env + Render)

```bash
PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
OPENAI_API_KEY=sk-...
AGENT_API_KEY=your-secret-api-key  # Required in production
CLOUDFLARE_DEPLOY_HOOK=https://api.cloudflare.com/...  # For rebuild button
```

---

## 13. Deployment

### 13.1 Cloudflare Pages (Frontend)

Static deployment with global CDN. Auto-deploys on push to `main`.

### 13.2 Render (Agent API)

The Agent API is hosted on [Render](https://render.com) as a Node.js web service.

**Setup:**

1. Go to Render → New → Web Service
2. Connect repo, set root directory to `services/agent-api`
3. Configure environment variables (see `services/agent-api/.env.example`)
4. Deploy with Starter plan ($7/mo)

See [`services/agent-api/DEPLOYMENT.md`](services/agent-api/DEPLOYMENT.md) for full deployment docs.

### 13.3 Deploy Hooks

Admin UI can trigger rebuilds via Cloudflare Deploy Hooks.

### 13.4 GitHub Actions

- **Nightly ingestion**: Discovers and enriches new content
- **Link checking**: Validates external links
- **Lighthouse CI**: Performance gates on PRs

---

## 14. Tech Stack

See [Section 4.1 Components](#41-components) for the full component table.

**Key technologies:** Astro 5, Next.js 15, TailwindCSS, TypeScript, Node.js/Express, Supabase (Postgres + RLS), OpenAI GPT-4o-mini, Playwright, GitHub Actions, Cloudflare Pages, Vercel, Render.

---

## 15. Roadmap

- [x] SonarCloud quality gate
- [x] Agentic discovery with LLM relevance scoring
- [x] Admin UX improvements (master-detail, source health, prompt testing)
- [ ] Embedding-based similarity search
- [ ] Golden Set integration in prompt editor
- [ ] Draft → Staged → Live prompt lifecycle

---

## 16. Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 17. License

MIT License. See [LICENSE](LICENSE).
