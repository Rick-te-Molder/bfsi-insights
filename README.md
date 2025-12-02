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

## 2. Table of Contents

1. [Overview](#1-overview)
2. [Table of Contents](#2-table-of-contents)
3. [Functional Description](#3-functional-description)
4. [System Architecture](#4-system-architecture)
5. [Agent Pipeline](#5-agent-pipeline)
6. [Data Model & Taxonomy](#6-data-model--taxonomy)
7. [Admin Workflows](#7-admin-workflows)
8. [Getting Started](#8-getting-started)
9. [Commands](#9-commands)
10. [Testing & Code Quality](#10-testing--code-quality)
11. [Quality & Compliance](#11-quality--compliance)
12. [Security](#12-security)
13. [Environment Variables](#13-environment-variables)
14. [Deployment](#14-deployment)
15. [Tech Stack](#15-tech-stack)
16. [Roadmap](#16-roadmap)
17. [Contributing](#17-contributing)
18. [License](#18-license)

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

### 4.1 High-Level Diagram

See [`docs/architecture/overview.md`](docs/architecture/overview.md) for architecture diagrams (Mermaid).

### 4.2 Components

| Component     | Technology                     | Purpose                           |
| ------------- | ------------------------------ | --------------------------------- |
| **Frontend**  | Astro (static + SSR for admin) | Public site and admin UI          |
| **Agent API** | Express.js (Node)              | Content enrichment pipeline       |
| **Database**  | Supabase (Postgres, RLS)       | Data storage and security         |
| **Storage**   | Supabase Storage               | Thumbnails                        |
| **CI/CD**     | GitHub Actions                 | Nightly ingestion, tests, deploys |
| **Hosting**   | Cloudflare Pages               | Global CDN deployment             |

### 4.3 Build & Deploy Flow

1. Admin approves publication
2. Admin triggers build (manual button or git push)
3. Astro rebuilds static site
4. Cloudflare Pages deploys to CDN

### 4.4 Additional Diagrams

- **BPMN ingestion flow**: [`/docs/bpmn/`](/docs/bpmn/) — See [`process-diagrams.md`](/docs/bpmn/process-diagrams.md) for Mermaid source
- **Data Flow Diagram**: [`/docs/dfd/`](/docs/dfd/) — See [`data-flows.md`](/docs/dfd/data-flows.md) for Mermaid source
- **Data model**: [`/docs/data-model/`](/docs/data-model/) — See [`schema.md`](/docs/data-model/schema.md) for ER diagram

> **Note:** Diagrams use Mermaid syntax. See [`/docs/index.md`](/docs/index.md) for viewing instructions.

---

## 5. Agent Pipeline

### 5.1 AI Agents

| Agent          | Purpose                                                  |
| -------------- | -------------------------------------------------------- |
| `discover.js`  | Discover content from RSS feeds, sitemaps, and web pages |
| `filter.js`    | Check BFSI relevance (GPT-4o-mini)                       |
| `summarize.js` | Generate summaries, extract date/author (GPT-4o-mini)    |
| `tag.js`       | Classify with taxonomies (GPT-4o-mini)                   |
| `thumbnail.js` | Screenshot article (Playwright)                          |

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

1. **Discovery**: Crawls RSS feeds, sitemaps, or web pages; filters by BFSI keywords
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

| Table            | Rows | Purpose                                                |
| ---------------- | ---- | ------------------------------------------------------ |
| `bfsi_industry`  | 53   | Banking sectors (banking, insurance, payments, etc.)   |
| `bfsi_topic`     | 5    | Content categories (strategy, technology, regulatory)  |
| `bfsi_geography` | —    | Countries/regions (global, eu, uk, us, etc.)           |
| `ag_use_case`    | 16   | AI use cases (customer-service, fraud-detection, etc.) |
| `ag_capability`  | 24   | AI capabilities (nlp, computer-vision, etc.)           |
| `regulator`      | 18   | Regulatory bodies (ecb, fca, sec, etc.)                |
| `regulation`     | 18   | Regulations/laws (gdpr, psd2, mifid, etc.)             |
| `obligation`     | 18   | Compliance requirements (dora-ict-risk, gdpr-dpo, etc) |

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

### 7.1 Submit a URL

Navigate to `/admin/add`. Paste URL → queued → auto-processed.

### 7.2 Review & Approve

`/admin/review` displays enriched items as preview cards. Click to approve.

### 7.3 Trigger Deployment

Click "Trigger Build" button or push to `main` branch.

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
node services/agent-api/src/cli.js discovery              # Find new publications
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

## 10. Testing & Code Quality

### 10.1 Test Strategy

The project follows a layered testing approach:

| Level           | Tool                        | Status    | Tests | Coverage                    |
| --------------- | --------------------------- | --------- | ----- | --------------------------- |
| **Unit**        | Vitest                      | ✅ Active | 68    | Utilities, filters, helpers |
| **Integration** | Lighthouse CI, Link Checker | ✅ Active | 4     | Performance, a11y, links    |
| **E2E**         | Playwright                  | ✅ Active | 28    | User journeys               |

### 10.2 Unit Tests (Vitest)

```bash
npm run test           # Run all unit tests
npm run test:watch     # Watch mode for development
```

**Current coverage:** 68 tests covering:

- `src/lib/filters.ts` — publication filtering logic (26 tests)
- `src/lib/authors.ts` — author normalization (10 tests)
- `src/lib/text.ts` — text linkify utilities (7 tests)
- `src/lib/fmt.ts` — date formatting (8 tests)
- `tests/utils/filename-helper.spec.ts` — slug, lastName, kbFileName (17 tests)

Focus on pure functions with deterministic output. See [docs/quality/sonar-exclusions.md](docs/quality/sonar-exclusions.md) for coverage policy.

### 10.3 Integration Tests

- **Lighthouse CI**: Enforces ≥95 scores for Performance, Accessibility, Best Practices, SEO
- **Link Checker**: Nightly validation of all external links in published content

**Current coverage:** 4 Lighthouse audits on `/` and `/publications`. Link checker validates all `source_url` values.

### 10.4 End-to-End Tests (Playwright)

```bash
npx playwright test              # Run all E2E tests
npx playwright test --ui         # Run with interactive UI
npx playwright test modal.spec   # Run specific test file
```

**Current coverage:** 28 tests covering search, filters, modal interactions, navigation, publication detail pages, and admin authentication flows.

### 10.5 Test Coverage Measurement

To quantify test coverage across all three levels:

| Level           | Measurement Method                             | Target |
| --------------- | ---------------------------------------------- | ------ |
| **Unit**        | `vitest --coverage` (c8/istanbul)              | ≥80%   |
| **Integration** | Lighthouse scores (automated)                  | ≥95    |
| **E2E**         | User journey coverage matrix (manual tracking) | 100%   |

```bash
# Generate unit test coverage report
npm run test -- --coverage
```

---

## 11. Quality & Compliance

### 11.1 Linting & Formatting

- ESLint and Prettier
- Enforced through CI and Husky pre-commit hook

```bash
npm run lint
```

### 11.2 Performance (Lighthouse CI)

Automatically checks `/` and `/publications` pages. Enforces scores ≥95 for:

- Performance
- Accessibility
- Best Practices
- SEO

### 11.3 Reliability (Link Checker)

Nightly CI checks all external links in published publications.

```bash
npm run check:links
```

### 11.4 Static Code Analysis (SonarCloud)

SonarCloud runs on every push and PR to enforce code quality.

**Quality Gate Checks:**

- Code smells and bugs
- Security vulnerabilities
- Test coverage (target: ≥80% on new code)
- Code duplication

**Coverage Exclusions:**

Some orchestration/infrastructure code is excluded from coverage requirements.
For the full list and rationale, see [docs/quality/sonar-exclusions.md](docs/quality/sonar-exclusions.md).

**Setup (one-time):**

1. Go to [sonarcloud.io](https://sonarcloud.io) and import the repository
2. Add `SONAR_TOKEN` secret in GitHub repository settings
3. Quality gate runs automatically on push/PR

```bash
# View results
https://sonarcloud.io/project/overview?id=Rick-te-Molder_bfsi-insights
```

### 11.5 Data Integrity & Accuracy

- Guardrail taxonomies prevent incorrect classifications
- Prompt versioning stored in `prompt_versions` table
- Deterministic thumbnail generation

---

## 12. Security

For detailed security policies and vulnerability reporting, see [SECURITY.md](SECURITY.md).

### 12.1 Authentication & Authorization

- Supabase Auth for admin users
- Admin UI uses SSR to avoid leaking keys

### 12.2 Row Level Security (RLS)

- All database tables protected with RLS
- RPCs verify admin status before mutating data

### 12.3 Secrets & Keys

- Supabase Vault stores sensitive data
- Cloudflare environment variables for deploy hooks
- No service keys in frontend code

---

## 13. Environment Variables

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

## 14. Deployment

### 14.1 Cloudflare Pages (Frontend)

Static deployment with global CDN. Auto-deploys on push to `main`.

### 14.2 Render (Agent API)

The Agent API is hosted on [Render](https://render.com) as a Node.js web service.

**Setup:**

1. Go to Render → New → Web Service
2. Connect repo, set root directory to `services/agent-api`
3. Configure environment variables (see `services/agent-api/.env.example`)
4. Deploy with Starter plan ($7/mo)

See [`services/agent-api/DEPLOYMENT.md`](services/agent-api/DEPLOYMENT.md) for full deployment docs.

### 14.3 Deploy Hooks

Admin UI can trigger rebuilds via Cloudflare Deploy Hooks.

### 14.4 GitHub Actions

- **Nightly ingestion**: Discovers and enriches new content
- **Link checking**: Validates external links
- **Lighthouse CI**: Performance gates on PRs

---

## 15. Tech Stack

| Layer          | Technology                                        |
| -------------- | ------------------------------------------------- |
| **Frontend**   | Astro 5, TailwindCSS, TypeScript                  |
| **Agents**     | Node.js (Express), OpenAI GPT-4o-mini, Playwright |
| **Backend**    | Supabase (Postgres, RLS, Edge Functions, Storage) |
| **Testing**    | Vitest, Playwright, Lighthouse CI                 |
| **CI/CD**      | GitHub Actions, SonarCloud                        |
| **Deployment** | Cloudflare Pages (frontend), Render (agents)      |

---

## 16. Roadmap

- [x] SonarCloud quality gate
- [ ] More granular taxonomy extraction
- [x] Wider crawling in discovery agent (sitemaps, robots.txt compliance)
- [ ] Embedding-based similarity search

---

## 17. Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 18. License

MIT License. See [LICENSE](LICENSE).
