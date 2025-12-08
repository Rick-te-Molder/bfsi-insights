# BFSI Insights

> Agentic AI insights for executives, professionals, and researchers in banking, financial services, and insurance.

A static-plus-agentic platform combining Astro, Supabase, Express-based agents, nightly pipelines, and an admin UI for real-time content ingestion and publication.

---

## 1. Overview

### 1.1 Purpose

BFSI Insights collects, enriches, classifies, and publishes high-quality AI-related insights for the banking, financial-services, and insurance industries. It automates discovery while maintaining editorial review and high data quality.

### 1.2 Audience

- Executives and professionals in BFSI
- Researchers following AI developments
- Contributors and developers of the platform
- Auditors, security teams, and technical reviewers

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
Agent                    Purpose                              Model/Tool
─────────────────────────────────────────────────────────────────────────
discovery-relevance.js   Find candidates from RSS/sitemaps    GPT-4o-mini
filter.js                Check BFSI relevance                 GPT-4o-mini
summarize.js             Generate summaries (short/med/long)  Claude Sonnet 4
tag.js                   Classify with taxonomies             GPT-4o-mini
thumbnail.js             Screenshot article for preview       Playwright
```

**Discovery modes:**

- `--agentic` — LLM scores relevance (default in nightly workflow)
- `--hybrid` — Embeddings pre-filter + LLM for uncertain cases
- _(no flag)_ — Rule-based keyword matching (fast but noisy)

### 5.2 Workflow States

#### Ingestion Queue (`ingestion_queue.status`)

| Status       | Actor | Description                                          |
| ------------ | ----- | ---------------------------------------------------- |
| `pending`    | 🤖    | Discovered via agentic pipeline, awaiting processing |
| `queued`     | 🤖    | Manual submission, ready for processing              |
| `processing` | 🤖    | Agent API currently processing                       |
| `fetched`    | 🤖    | Content retrieved from URL                           |
| `filtered`   | 🤖    | Passed BFSI relevance check                          |
| `summarized` | 🤖    | AI summaries generated                               |
| `tagged`     | 🤖    | Taxonomy tags applied                                |
| `enriched`   | 🤖    | Ready for human review                               |
| `approved`   | 👤    | Human approved → moved to kb_publication             |
| `rejected`   | 🤖/👤 | Not BFSI relevant (filter¹) or human rejected        |
| `failed`     | 🤖    | Processing error (can retry)                         |

> ¹ **Note:** Filter rejection only applies to nightly RSS discovery. Manual submissions skip filter rejection since a human explicitly submitted the URL.

#### Publication (`kb_publication.status`)

| Status      | Actor | Description                      |
| ----------- | ----- | -------------------------------- |
| `published` | 👤    | Live on website (after approval) |
| `draft`     | 👤    | Created but not yet live         |
| `archived`  | 👤    | Removed from public view         |

#### State Flow Diagram

```
Manual:   queued → processing → filtered → summarized → tagged → enriched
                                                                    ↓
Nightly:  pending → fetched → filtered → summarized → tagged → enriched
                                                                    ↓
                                              👤 Review → approved → published
                                                       ↘ rejected
```

### 5.3 Content Ingestion Options

#### Option 1: Manual URL Submission (Real-time)

```
/admin/add → DB Trigger → Render API → enriched → /admin/review → Approve → Published
```

1. Paste URL at `/admin/add`
2. DB trigger fires, calls Render-hosted Agent API
3. UI polls for status updates (`queued` → `processing` → `enriched`)
4. Review and approve at `/admin/review`
5. Click "Trigger Build" → Cloudflare deploys

#### Option 2: Nightly Pipeline (🌙 Automated)

```
pending → fetched → filtered → summarized → tagged → enriched → 👤 Review → Published
```

Runs automatically at 2 AM UTC via GitHub Actions:

1. **Discovery**: Crawls RSS feeds and sitemaps; LLM scores relevance (`--agentic` mode)
2. **Enrichment**: Runs filter → summarize → tag → thumbnail (limit 20/night)
3. **Review**: Human approves at `/admin/review`
4. **Deploy**: Click "Trigger Build" or push to git

### 5.4 Running the Pipeline

**CLI:**

```bash
node services/agent-api/src/cli.js discovery --limit=10
node services/agent-api/src/cli.js enrich --limit=20
node services/agent-api/src/cli.js process-queue --limit=5
```

**HTTP API:**

```bash
POST /api/agents/run/discovery
POST /api/agents/run/filter
POST /api/agents/run/summarize
```

### 5.5 Agent Evaluation & Optimization

The core workflow produces **rejection reasons** when humans reject articles. This data feeds into a **periodic optimization cycle** (separate from the content workflow).

```
Core Workflow:      Entry → Pipeline → Review → Published/Rejected
                                                      ↓
                                             rejection_reason stored
                                                      ↓
Optimization:       Periodic analysis → Prompt tuning → A/B testing
(monthly)
```

#### Evaluation Framework (`evals.js`)

| Method                 | Description                                          | Use Case                                |
| ---------------------- | ---------------------------------------------------- | --------------------------------------- |
| **Golden Dataset**     | Compare agent output against human-verified examples | Regression testing after prompt changes |
| **LLM-as-Judge**       | Second LLM evaluates output quality (0-1 score)      | Continuous quality monitoring           |
| **A/B Prompt Testing** | Compare two prompt versions side-by-side             | Validating prompt improvements          |

#### Optimization Tables

| Table             | Purpose                                       |
| ----------------- | --------------------------------------------- |
| `eval_golden_set` | Human-verified input/output pairs per agent   |
| `eval_run`        | Evaluation run metadata and results           |
| `eval_result`     | Individual example results per run            |
| `prompt_versions` | Prompt version history with `is_current` flag |

> **Note:** Rejection reasons from human review should be periodically analyzed to identify systematic agent failures, then addressed via prompt refinement validated through EVALs.

---

## 6. Data Model & Taxonomy

### 6.1 Core Tables

| Table                   | Purpose                     |
| ----------------------- | --------------------------- |
| `kb_publication`        | Main publication data       |
| `kb_publication_pretty` | Flattened view for frontend |
| `ingestion_queue`       | Processing pipeline queue   |
| `kb_source`             | RSS feed sources            |
| `prompt_versions`       | Versioned AI prompts        |

### 6.2 Guardrail Taxonomies (curated, fixed lists)

LLM picks from these pre-defined lists. **Do not auto-create entries.**

| Table           | Rows | Purpose                                                |
| --------------- | ---- | ------------------------------------------------------ |
| `bfsi_industry` | 53   | Banking sectors (banking, insurance, payments, etc.)   |
| `bfsi_topic`    | 5    | Content categories (strategy, technology, regulatory)  |
| `kb_geography`  | 30   | Countries/regions (global, eu, uk, us, gcc, etc.)      |
| `ag_use_case`   | 16   | AI use cases (customer-service, fraud-detection, etc.) |
| `ag_capability` | 24   | AI capabilities (nlp, computer-vision, etc.)           |
| `regulator`     | 18   | Regulatory bodies (ecb, fca, sec, etc.)                |
| `regulation`    | 18   | Regulations/laws (gdpr, psd2, mifid, etc.)             |
| `obligation`    | 18   | Compliance requirements (dora-ict-risk, gdpr-dpo, etc) |

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

> **Why guardrails?** Regulatory info requires expert curation — auto-generated compliance data could mislead users and create liability.

### 6.3 Expandable Taxonomies (grow from publications)

LLM extracts names; new entries can be created.

| Table               | Rows | Purpose                               |
| ------------------- | ---- | ------------------------------------- |
| `bfsi_organization` | 8    | Banks, insurers mentioned in articles |
| `ag_vendor`         | 81   | AI/tech vendors mentioned in articles |

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

### 9.2 Agent CLI (Command-Line Interface) Commands

```bash
node services/agent-api/src/cli.js discovery              # Find new publications (rule-based)
node services/agent-api/src/cli.js discovery --agentic    # LLM relevance scoring (nightly default)
node services/agent-api/src/cli.js discovery --hybrid     # Embeddings + LLM for uncertain
node services/agent-api/src/cli.js discovery --limit=10   # Limit to 10 items
node services/agent-api/src/cli.js discovery --dry-run    # Preview only
node services/agent-api/src/cli.js discovery --premium    # Include premium sources

node services/agent-api/src/cli.js classics               # Discover classic papers via Semantic Scholar
node services/agent-api/src/cli.js classics --no-expand   # Skip citation expansion
node services/agent-api/src/cli.js classics --dry-run     # Preview only

node services/agent-api/src/cli.js enrich --limit=20      # Full pipeline
node services/agent-api/src/cli.js filter --limit=10      # Filter only
node services/agent-api/src/cli.js summarize --limit=5    # Summarize only
node services/agent-api/src/cli.js tag --limit=5          # Tag only
node services/agent-api/src/cli.js thumbnail --limit=5    # Thumbnails only

node services/agent-api/src/cli.js process-queue          # Process manual submissions
node services/agent-api/src/cli.js queue-health           # Monitor queue health & backlog

# Evals
node services/agent-api/src/cli.js eval --agent=relevance-filter --type=golden
node services/agent-api/src/cli.js eval --agent=content-summarizer --type=judge
node services/agent-api/src/cli.js eval-history --agent=relevance-filter
```

### 9.3 Utility Commands

```bash
npm run check:links                    # Check for broken links
npm run build && npm run lhci          # Run Lighthouse CI locally
```

### 9.4 Maintenance Scripts

One-time or periodic data maintenance scripts:

```bash
# Backfill missing publication dates
node services/agent-api/src/scripts/backfill-dates.js --dry-run
node services/agent-api/src/scripts/backfill-dates.js --limit=50

# Re-run summarizer on all publications
node services/agent-api/src/scripts/backfill-summaries.js --dry-run
node services/agent-api/src/scripts/backfill-summaries.js --limit=100

# Backfill missing taxonomy tags
node services/agent-api/src/scripts/backfill-tags.js --dry-run
node services/agent-api/src/scripts/backfill-tags.js --limit=50
```

Shared utilities for scripts are in `services/agent-api/src/scripts/utils.js`.

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
