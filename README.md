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
│   ├── data/         # Resource data (items/, resources.json)
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
- `src/data/resources/items/` — Canonical store for resource items (per-item JSONs). Run `scripts/build-resources.mjs` to regenerate `resources.json`.
- `scripts/` — Includes utilities like `generate-notes.mjs` to fill per-item notes from URLs.

## Getting Started

### Feeds

- RSS: https://www.bfsiinsights.com/feed.xml
- Updates JSON (latest 20): https://www.bfsiinsights.com/updates.json

Add this to an RSS reader (Feedly/Reeder) or automate via Zapier/IFTTT. The JSON endpoint is ideal for lightweight clients and dashboards.

### Quality gates

- Link checker: runs on CI (and nightly) to detect broken external links in `src/data/resources/resources.json`.
- Lighthouse CI: enforces ≥95 for Performance, Accessibility, Best Practices, and SEO on `/` and `/resources`. Reports are uploaded as CI artifacts.

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

```text
┌─────────────────────────────────────────────────────────────────┐
│ 1. DISCOVERY (ingestion_queue)                                 │
│    • Run: npm run discover -- --source=arxiv --limit=10        │
│    • Agent scrapes RSS feeds, extracts URLs & basic metadata   │
│    • Status: pending                                           │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. ENRICHMENT (ingestion_queue)                                │
│    • Run: npm run enrich -- --limit=5                          │
│    • LLM generates summaries, scores personas, extracts tags   │
│    • Multi-value support:                                      │
│      - industries: ["banking", "insurance"] (1-3 values)      │
│      - topics: ["ai", "risk"] (1-3 values)                   │
│      - vendors: ["OpenAI", "Anthropic"] (0-n values)         │
│      - organizations: ["JPMorgan"] (0-n values)               │
│    • Captures thumbnails using Playwright                      │
│    • Status: pending → enriched                                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. REVIEW (Supabase UI)                                        │
│    • Admin reviews complete card with thumbnail                │
│    • Verifies summaries, tags, quality score                   │
│    • Actions:                                                  │
│      - Approve: Change status to 'approved'                    │
│      - Reject: Change status to 'rejected'                     │
│      - Edit: Manual refinements before approval                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. PUBLISHING (kb_resource + junction tables)                  │
│    • Run: npm run publish:approved                             │
│    • Moves approved items to kb_resource                       │
│    • Populates junction tables:                                │
│      - kb_resource_bfsi_industry (0..n)                        │
│      - kb_resource_bfsi_topic (0..n)                           │
│      - kb_resource_ag_vendor (0..n, auto-creates)              │
│      - kb_resource_bfsi_organization (0..n, auto-creates)      │
│    • Status: approved → published                              │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. BUILD (Static site generation)                              │
│    • Run: npm run build:resources                              │
│    • Reads from kb_resource_pretty view (joins junction tables)│
│    • Generates resources.json for Astro                        │
│    • Run: npm run build                                        │
│    • Builds static site to ./dist/                             │
└─────────────────────────────────────────────────────────────────┘
```

### Quick Start

```bash
# 1. Discover new resources
npm run discover -- --source=arxiv --limit=10

# 2. Enrich pending items
npm run enrich -- --limit=5

# 3. Review in Supabase UI, approve items

# 4. Publish approved items
npm run publish:approved --dry-run  # Preview
npm run publish:approved            # Actually publish

# 5. Build and deploy
npm run build:resources
npm run build
git push
```

### Multi-Value Dimension Support

Resources can now have **multiple** industries, topics, vendors, and organizations:

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

---

OUTPUT

1. One line: FILENAME: <computed_filename.json>
2. One JSON object only (no prose).

FILENAME RULE  
<year>_<slug>_<author-lastname>-<publisher-slug>[_v<version>].json

- year = YYYY from date_published
- slug = hyphenated, lowercase, from title
- author-lastname = last name of first author, keep particles (e.g., van-der-waa)
- publisher-slug = short slug from publisher name (e.g., mckinsey, ecb)
- underscores between fields, hyphens within fields, all lowercase

JSON KEYS (strictly per schema)

```
kb.item
├─ type: object
├─ additionalProperties: false
├─ properties
│ ├─ url: string (uri) [REQ]
│ ├─ title: string
│ ├─ slug: string (pattern: ^[a-z0-9]+(?:-[a-z0-9]+)\*$)
│  ├─ authors: array<string>
│  ├─ source_name: string
│  ├─ source_domain: string
│  ├─ thumbnail: string
│  ├─ date_published: string (date)
│  ├─ date_added: string (date-time)
│  ├─ last_edited: string (date-time)
│  ├─ role: string [REQ]
│  │  └─ one of: executive | professional | academic
│  ├─ industry: string [REQ]
│  │  ├─ banking
│  │  │  ├─ retail-banking
│  │  │  ├─ corporate-banking
│  │  │  ├─ lending
│  │  │  ├─ payments
│  │  │  ├─ deposits
│  │  │  ├─ treasury
│  │  │  ├─ capital-markets
│  │  │  └─ digital-banking
│  │  ├─ financial-services
│  │  │  ├─ financial-advice
│  │  │  ├─ wealth-management
│  │  │  ├─ asset-management
│  │  │  ├─ leasing
│  │  │  ├─ factoring
│  │  │  ├─ pension-funds
│  │  │  └─ insurance-brokerage
│  │  ├─ insurance
│  │  │  ├─ health-insurance
│  │  │  ├─ life-insurance
│  │  │  ├─ pension-insurance
│  │  │  └─ property-and-casualty
│  │  └─ cross-bfsi
│  │     ├─ infrastructure
│  │     ├─ shared-services
│  │     └─ b2b-platforms
│  ├─ topic: string [REQ]
│  │  ├─ strategy-and-management
│  │  │  ├─ strategy
│  │  │  ├─ operating-models
│  │  │  ├─ transformation
│  │  │  └─ case-studies
│  │  ├─ ecosystem
│  │  │  ├─ vendors
│  │  │  ├─ institutions
│  │  │  ├─ bfsi-sector
│  │  │  └─ ai-industry
│  │  ├─ governance-and-control
│  │  │  ├─ governance
│  │  │  ├─ risk-management
│  │  │  ├─ compliance
│  │  │  ├─ financial-crime-prevention
│  │  │  │  ├─ kyc
│  │  │  │  ├─ cdd
│  │  │  │  ├─ aml
│  │  │  │  ├─ fraud-detection
│  │  │  │  └─ sanctions-screening
│  │  │  ├─ auditing
│  │  │  └─ internal-controls
│  │  ├─ regulatory-and-standards
│  │  │  ├─ regulation
│  │  │  ├─ standards
│  │  │  ├─ policy
│  │  │  └─ guidance
│  │  ├─ technology-and-data
│  │  │  ├─ ai
│  │  │  ├─ agentic-engineering
│  │  │  ├─ rag
│  │  │  ├─ orchestration
│  │  │  ├─ data-management
│  │  │  ├─ infrastructure
│  │  │  ├─ cybersecurity
│  │  │  └─ monitoring
│  │  └─ methods-and-approaches
│  │     ├─ methodology
│  │     ├─ models
│  │     └─ best-practices
│  ├─ use_cases: string [REQ]
│  │  ├─ customer-onboarding
│  │  ├─ identity-verification
│  │  ├─ document-processing
│  │  ├─ transaction-monitoring
│  │  ├─ credit-assessment
│  │  ├─ fraud-detection
│  │  ├─ claims-handling
│  │  ├─ portfolio-analytics
│  │  ├─ regulatory-reporting
│  │  └─ audit-support
│  ├─ agentic_capabilities: string [REQ]
│  │  ├─ reasoning
│  │  ├─ planning
│  │  ├─ memory
│  │  ├─ tool-use
│  │  ├─ collaboration
│  │  ├─ autonomy
│  │  ├─ evaluation
│  │  └─ monitoring
│  ├─ content_type: string [REQ]
│  │  ├─ report
│  │  ├─ white-paper
│  │  ├─ peer-reviewed-paper
│  │  ├─ article
│  │  ├─ presentation
│  │  ├─ webinar
│  │  ├─ dataset
│  │  ├─ website
│  │  └─ policy-document
│  ├─ jurisdiction: string [REQ]
│  │  ├─ eu
│  │  ├─ uk
│  │  ├─ us
│  │  ├─ nl
│  │  ├─ global
│  │  └─ other
│  ├─ note: string
│  └─ id: string (pattern: ^[a-f0-9]{40}$)
└─ required:
   url, role, industry, topic, use_cases,
   agentic_capabilities, content_type, jurisdiction
```

RULES

- Fetch and read the URL at the top.
- Use canonical URL (no tracking, consistent trailing slash policy).
- Normalize publisher → source_name and source_domain.
- Derive slug from title.
- Derive filename year from date_published (YYYY).
- Authors: full names; filename uses first author’s last name (keep particles).
- Choose enum values strictly from the lists above.
- If unclear: role=professional; industry=cross-bfsi; topic=technology-and-data-ai; jurisdiction=global.
- Set date_added and last_edited to the current ISO datetime.
- Do **NOT** include any “time” field.
- Output exactly two blocks:
  1. `FILENAME: ...`
  2. JSON object only.  
     No markdown, no prose, no explanations.
