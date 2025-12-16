# BFSI Insights

> Agentic AI insights for executives, professionals, and researchers in banking, financial services, and insurance.

A static-plus-agentic platform combining Astro, Supabase, Express-based agents, nightly pipelines, and an admin UI for real-time content ingestion and publication.

---

## 1. Overview

### Purpose

BFSI Insights collects, enriches, classifies, and publishes high-quality AI-related insights for the banking, financial-services, and insurance industries. It automates discovery while maintaining editorial review and high data quality.

### Target Audience

- **Executives** — C-suite, senior consultants, strategy advisors in BFSI
- **Functional Specialists** — Risk, compliance, operations, product managers
- **Engineers** — Developers, architects, data scientists building BFSI solutions
- **Researchers** — Academics, analysts tracking AI/fintech developments

### Key Features

- Agentic and manual content ingestion with LLM relevance scoring
- AI-based filtering, summarization, tagging, and thumbnail generation
- Guardrail taxonomies (industry, topics, AI use cases, regulations)
- Expandable taxonomies (organizations, vendors)
- Admin UI for reviewing, approving, and publishing
- Dashboard with agent controls (run batches, pause discovery)
- Supabase-based data with RLS-secured admin functions

### High-Level Workflow

```
Discovery:  Nightly RSS/sitemap scan → LLM relevance scoring
                          ↓
Pipeline:   fetch → summarize → tag → thumbnail → pending_review
                          ↓
Review:     👤 Approve → Published  |  👤 Reject → Rejected
```

---

## 2. System Architecture

### Components

| Component      | Role                             | Tech               | Hosting    |
| -------------- | -------------------------------- | ------------------ | ---------- |
| **Database**   | Guardrails, SOR, config, storage | Postgres + Storage | Supabase   |
| **Agent API**  | Discover, filter, summarize, tag | Node.js/Express    | Render     |
| **Website**    | Browse, search, read             | Astro + Tailwind   | Cloudflare |
| **Admin**      | Review, approve, ingest          | Next.js 15         | Vercel     |
| **Automation** | Nightly jobs, tests, CI          | GitHub Actions     | GitHub     |

### Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│  APPLICATION    Website (public) │ Admin (internal) │ Agent API │
├─────────────────────────────────────────────────────────────────┤
│  DATA           Publications │ Taxonomies │ Config │ Prompts    │
├─────────────────────────────────────────────────────────────────┤
│  INFRASTRUCTURE Supabase │ Cloudflare │ Render │ Vercel         │
└─────────────────────────────────────────────────────────────────┘
```

See [`docs/architecture/overview.md`](docs/architecture/overview.md) for detailed diagrams.

---

## 3. Agent Pipeline

### Agents

| Agent       | Purpose                        | Model/Tool    |
| ----------- | ------------------------------ | ------------- |
| discoverer  | Find candidates from RSS/sites | —             |
| scorer      | Score relevance per audience   | GPT-4o-mini   |
| fetcher     | Fetch page content (HTML/PDF)  | Playwright    |
| screener    | Second-pass BFSI filter        | GPT-4o-mini   |
| summarizer  | Generate summaries             | Claude Sonnet |
| tagger      | Classify with taxonomies       | GPT-4o        |
| thumbnailer | Screenshot for preview         | Playwright    |

### Pipeline Status Flow

```
discovered → fetched → scored → to_summarize → summarized → to_tag → tagged → to_thumbnail → pending_review → approved/rejected
```

See [`docs/architecture/pipeline-status-codes.md`](docs/architecture/pipeline-status-codes.md) for full status documentation.

### Pipeline Orchestration

The pipeline includes run tracking, failure handling, and health monitoring:

| Feature               | Description                                                              |
| --------------------- | ------------------------------------------------------------------------ |
| **Run Tracking**      | Each enrichment attempt creates a `pipeline_run` with step-level tracing |
| **Step Outcomes**     | `pipeline_step_run` records status, duration, errors per step            |
| **Re-enrich**         | Creates fresh run, cancels old (prevents mixed outputs)                  |
| **Dead Letter Queue** | Items failing 3+ times on same step → status 599                         |
| **WIP Limits**        | Backpressure per stage (summarizer: 10, tagger: 20, thumbnailer: 5)      |
| **Health Dashboard**  | `/pipeline` shows WIP, throughput, stuck items, DLQ count                |

```
pipeline_run (per enrichment attempt)
  └── pipeline_step_run (summarize, tag, thumbnail)
        └── status, duration, error_message, error_signature
```

### Running the Pipeline

```bash
# Discovery (finds new content)
node services/agent-api/src/cli.js discovery --agentic --limit=10

# Enrichment (processes pending items)
node services/agent-api/src/cli.js enrich --limit=20

# Individual agents
node services/agent-api/src/cli.js summarize|tag|thumbnail --limit=5
```

---

## 4. Data Model

### Core Tables

| Table             | Purpose                   |
| ----------------- | ------------------------- |
| `kb_publication`  | Published articles        |
| `ingestion_queue` | Processing pipeline queue |
| `kb_source`       | RSS feed sources          |
| `prompt_version`  | Versioned AI prompts      |

### Taxonomies

**Guardrail** (LLM picks from list): `bfsi_industry`, `bfsi_topic`, `kb_geography`, `ag_use_case`, `ag_capability`

**Expandable** (LLM can add entries): `ag_vendor`, `bfsi_organization`, `regulator`, `regulation`

See [`docs/data-model/schema.md`](docs/data-model/schema.md) for full ER diagram.

---

## 5. Admin UI

The admin UI (`admin-next/`) is a Next.js 15 app:

- **Dashboard** — Pipeline stats, agent controls (run batches, pause discovery)
- **Review Queue** — Master-detail with keyboard shortcuts (↑↓ navigate, a/r/e actions)
- **Pipeline Health** — WIP utilization, throughput, stuck items, DLQ alerts
- **Sources** — Health indicators (🟢🟡🔴), discovery stats
- **Prompts** — Version history, test playground
- **Golden Sets** — Curated test cases for prompt evaluation

### Key Workflows

| Workflow      | Path           | Description                          |
| ------------- | -------------- | ------------------------------------ |
| Submit URL    | `/add`         | Manual submission → auto-enriched    |
| Review        | `/review`      | Approve/reject with taxonomy editing |
| Trigger Build | Sidebar button | Deploy to Cloudflare                 |

---

## 6. Getting Started

### Prerequisites

- Node.js 20+
- Supabase project
- OpenAI API key

### Local Setup

```bash
# Frontend (Astro site)
npm install && npm run dev

# Admin UI
cd admin-next && npm install && npm run dev

# Agent API
cd services/agent-api && npm install && node src/index.js
```

---

## 7. Commands

### Frontend

| Command         | Action                            |
| --------------- | --------------------------------- |
| `npm run dev`   | Start dev server (localhost:4321) |
| `npm run build` | Build production site             |
| `npm run lint`  | Run ESLint                        |

### Agent CLI

```bash
node services/agent-api/src/cli.js discovery --agentic --limit=10
node services/agent-api/src/cli.js enrich --limit=20
node services/agent-api/src/cli.js eval --agent=screener --type=golden
```

---

## 8. Testing & Quality

| Level       | Tool       | Target         |
| ----------- | ---------- | -------------- |
| Unit        | Vitest     | ≥80% coverage  |
| E2E         | Playwright | Critical paths |
| Performance | Lighthouse | ≥95 score      |

```bash
npm run test              # Unit tests
npx playwright test       # E2E tests
npm run check:links       # Link checker
```

**Code Quality:** ESLint + Prettier (Husky pre-commit), SonarCloud on PRs.

---

## 9. Security

See [SECURITY.md](SECURITY.md) for policies and vulnerability reporting.

- **Auth**: Supabase Auth for admin users
- **RLS**: All tables protected; RPCs verify admin status
- **Secrets**: Supabase Vault; no service keys in frontend

---

## 10. Environment Variables

### Frontend (.env)

```bash
PUBLIC_SUPABASE_URL=https://xxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### Agent API (.env)

```bash
PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
OPENAI_API_KEY=sk-...
AGENT_API_KEY=your-secret-api-key
```

---

## 11. Deployment

| Component | Platform   | Trigger         |
| --------- | ---------- | --------------- |
| Website   | Cloudflare | Push to main    |
| Admin     | Vercel     | Push to main    |
| Agent API | Render     | Push to main    |
| Nightly   | GH Actions | Cron (2 AM UTC) |

See [`services/agent-api/DEPLOYMENT.md`](services/agent-api/DEPLOYMENT.md) for full deployment docs.

---

## 12. Roadmap

- [x] SonarCloud quality gate
- [x] Agentic discovery with LLM relevance scoring
- [x] Admin UX improvements (master-detail, source health, prompt testing)
- [x] Dashboard agent controls (run batches, pause discovery)
- [x] Pipeline orchestration (run tracking, DLQ, WIP limits, health dashboard)
- [ ] Embedding-based similarity search
- [ ] Golden Set integration in prompt editor
- [ ] Draft → Staged → Live prompt lifecycle

---

## 13. Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 14. License

MIT License. See [LICENSE](LICENSE).
