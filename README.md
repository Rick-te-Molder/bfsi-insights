# BFSI Insights

> Agentic AI insights for executives, professionals, and researchers in banking, financial services, and insurance.

A static-plus-agentic platform combining Astro, Supabase, Express-based agents, nightly pipelines, and an admin UI for real-time content ingestion and publication.

---

## 1. Overview

### 1.1 Purpose

BFSI Insights collects, enriches, classifies, and publishes high-quality AI-related insights for the banking, financial-services, and insurance industries. It automates discovery while maintaining editorial review and high data quality.

### 1.2 Audience

- Executives and practitioners in BFSI
- Researchers following AI developments
- Contributors and developers of the platform
- Auditors, security teams, and technical reviewers

### 1.3 Key Features

- Automated and manual content ingestion
- AI-based filtering, summarization, tagging, and thumbnail generation
- Guardrail taxonomies (industry, topics, AI use cases, regulations)
- Expandable taxonomies (organizations, vendors)
- Admin UI for reviewing, approving, and publishing
- Supabase-based data with RLS-secured admin functions
- GitHub Actions nightly ingestion & link checking

### 1.4 High-Level Workflow

```
Discover → Filter → Summarize → Tag → Thumbnail → Review → Approve → Published
```

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

- Collects and enriches BFSI-related content from RSS feeds and manual submissions
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

See [`/docs/architecture/high-level-architecture.png`](/docs/architecture/high-level-architecture.png)

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
2. Build trigger (manual button or git push)
3. Astro rebuilds static site
4. Cloudflare Pages deploys to CDN

### 4.4 Additional Diagrams

- BPMN ingestion flow: [`/docs/bpmn/ingestion-process.png`](/docs/bpmn/ingestion-process.png)
- Data Flow Diagram: [`/docs/dfd/dfd-level-1.png`](/docs/dfd/dfd-level-1.png)
- Data model: [`/docs/data-model/logical.png`](/docs/data-model/logical.png)

---

## 5. Agent Pipeline

### 5.1 Pipeline Stages

```
DISCOVERY → FILTER → SUMMARIZE → TAG → THUMBNAIL
```

| Stage     | Agent          | Purpose                                               |
| --------- | -------------- | ----------------------------------------------------- |
| Discovery | `discovery.js` | Scrape RSS feeds, find new URLs                       |
| Filter    | `filter.js`    | Check BFSI relevance (GPT-4o-mini)                    |
| Summarize | `summarize.js` | Generate summaries, extract date/author (GPT-4o-mini) |
| Tag       | `tag.js`       | Classify with taxonomies (GPT-4o-mini)                |
| Thumbnail | `thumbnail.js` | Screenshot article (Playwright)                       |

### 5.2 Content Ingestion Options

#### Option 1: Manual URL Submission (Async Queue)

```
/admin/add → Agent API → enriched → /admin/review → Approve → Published
```

1. Paste URL at `/admin/add`
2. URL is queued, Agent API processes asynchronously (~30-60 seconds)
3. UI polls for status updates (queued → processing → enriched)
4. Review and approve at `/admin/review`
5. Click "Trigger Build" or push to git → Published

#### Option 2: Nightly Pipeline (🌙 Automated)

```
Discovery → Filter → Summarize → Tag → Thumbnail → Review → Approve → Published
```

Runs automatically at 2 AM UTC via GitHub Actions:

1. **Discovery**: Scrapes RSS feeds, filters by BFSI keywords
2. **Enrichment**: Runs filter → summarize → tag → thumbnail (limit 20/night)
3. **Review**: Human approves at `/admin/review`
4. **Deploy**: Click "Trigger Build" or push to git

### 5.3 Running the Pipeline

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
| `obligation`     | —    | Compliance requirements (expert-curated)               |

### 6.3 Expandable Taxonomies (grow from publications)

LLM extracts names; new entries can be created.

| Table               | Rows | Purpose                               |
| ------------------- | ---- | ------------------------------------- |
| `bfsi_organization` | 8    | Banks, insurers mentioned in articles |
| `ag_vendor`         | 81   | AI/tech vendors mentioned in articles |

### 6.4 Why Guardrails for Regulations?

- **Accuracy is critical** — regulatory errors have compliance consequences
- **Structure matters** — regulator → regulation → obligation hierarchy
- **Expert curation** — should be reviewed by compliance professionals
- **Liability** — auto-generated regulatory info could mislead users

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

### 9.2 Agent CLI Commands

```bash
node services/agent-api/src/cli.js discovery              # Find new publications
node services/agent-api/src/cli.js discovery --limit=10   # Limit to 10 items
node services/agent-api/src/cli.js discovery --dry-run    # Preview only

node services/agent-api/src/cli.js enrich --limit=20      # Full pipeline
node services/agent-api/src/cli.js filter --limit=10      # Filter only
node services/agent-api/src/cli.js summarize --limit=5    # Summarize only
node services/agent-api/src/cli.js tag --limit=5          # Tag only
node services/agent-api/src/cli.js thumbnail --limit=5    # Thumbnails only

node services/agent-api/src/cli.js process-queue          # Process manual submissions
```

### 9.3 Utility Commands

```bash
npm run check:links                    # Check for broken links
npm run build && npm run lhci          # Run Lighthouse CI locally
```

---

## 10. Testing & Code Quality

### 10.1 Test Strategy

The project follows a layered testing approach:

| Level           | Tool                        | Status     | Coverage                           |
| --------------- | --------------------------- | ---------- | ---------------------------------- |
| **Unit**        | Vitest                      | 🔜 Planned | Utilities, helpers, pure functions |
| **Integration** | Lighthouse CI, Link Checker | ✅ Active  | Performance, accessibility, links  |
| **E2E**         | Playwright                  | ✅ Active  | User journeys (28 tests)           |

### 10.2 End-to-End Tests (Playwright)

```bash
npx playwright test              # Run all E2E tests
npx playwright test --ui         # Run with interactive UI
npx playwright test modal.spec   # Run specific test file
```

**Test coverage:** search, filters, modal, navigation, publication detail, admin auth

### 10.3 Integration Tests

- **Lighthouse CI**: Enforces ≥95 scores for Performance, Accessibility, Best Practices, SEO
- **Link Checker**: Nightly validation of all external links

### 10.4 Unit Tests (Planned)

```bash
# Future: npm run test:unit
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

### 11.4 Static Code Analysis (Planned)

**Planned:** Integrate SonarCloud to enforce a quality gate in CI.

Goals:

- Detect vulnerabilities and code smells
- Track maintainability and technical debt
- Add PR annotations

### 11.5 Data Integrity & Accuracy

- Guardrail taxonomies prevent incorrect classifications
- Prompt versioning stored in `prompt_versions` table
- Deterministic thumbnail generation

---

## 12. Security

### 12.1 Authentication & Authorization

- Supabase Auth for admin users
- Admin UI is SSR to avoid leaking keys

### 12.2 Row Level Security (RLS)

- All database tables protected with RLS
- RPCs verify admin status when mutating data

### 12.3 Secrets & Keys

- Supabase Vault for sensitive data
- Cloudflare environment variables for deploy hooks
- No service keys in frontend code

---

## 13. Environment Variables

```bash
# Supabase
PUBLIC_SUPABASE_URL=https://xxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...

# OpenAI
OPENAI_API_KEY=sk-...

# Cloudflare (optional, for deploy hooks)
CLOUDFLARE_DEPLOY_HOOK=https://api.cloudflare.com/...
```

---

## 14. Deployment

### 14.1 Cloudflare Pages

Static deployment with global CDN. Auto-deploys on push to `main`.

### 14.2 Deploy Hooks

Admin UI can trigger rebuilds via Cloudflare Deploy Hooks.

### 14.3 GitHub Actions

- **Nightly ingestion**: Discovers and enriches new content
- **Link checking**: Validates external links
- **Lighthouse CI**: Performance gates on PRs

---

## 15. Tech Stack

| Layer          | Technology                                        |
| -------------- | ------------------------------------------------- |
| **Frontend**   | Astro 5, TailwindCSS, TypeScript                  |
| **Agents**     | Node.js (Express), OpenAI GPT-4o-mini             |
| **Backend**    | Supabase (Postgres, RLS, Edge Functions, Storage) |
| **Testing**    | Playwright, Lighthouse CI                         |
| **CI/CD**      | GitHub Actions                                    |
| **Deployment** | Cloudflare Pages                                  |

---

## 16. Roadmap

- [ ] SonarCloud quality gate
- [ ] Unit tests with Vitest
- [ ] More granular taxonomy extraction
- [ ] Wider crawling in discovery agent
- [ ] Embedding-based similarity search
- [ ] Multilingual summarization

---

## 17. Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 18. License

MIT License. See [LICENSE](LICENSE).
