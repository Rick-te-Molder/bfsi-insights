# BFSI Insights

Agentic AI insights for executives and professionals in banking, financial services and insurance.

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

bfsi-insights/
├── .github/
│ └── workflows/…
├── .lighthouserc.json
├── .lighthouserc.desktop.json
├── .nvmrc
├── .prettierignore
├── .prettierrc
├── .vscode/
│ ├── extensions.json
│ └── settings.json
├── README.md
├── astro.config.mjs
├── eslint.config.js
├── package.json
├── package-lock.json
├── postcss.config.js
├── public/
│ ├── favicon-dark.svg
│ ├── favicon-light.svg
│ ├── favicon.ico (optional; consider removing or replacing with transparent)
│ ├── safari-pinned-tab.svg
│ └── thumbs/ (generated/added thumbnails)
├── schemas/
│ └── kb.schema.json
├── scripts/
│ ├── add-url.mjs
│ ├── build-resources.mjs (compose src/data/resources/resources.json from items)
│ ├── check-links.mjs
│ ├── filename-helper.mjs
│ ├── generate-notes.mjs (writes notes into per-item files)
│ └── lint-items-no-time.mjs
├── src/
│ ├── data/
│ │ └── resources/
│ │ ├── items/ (per-item JSONs; source of truth)
│ │ └── resources.json (composed output used by pages)
│ ├── layouts/
│ │ └── Base.astro
│ ├── pages/
│ │ ├── index.astro (Homepage; “Latest” grid)
│ │ └── resources.astro (Resources list with filters)
│ └── styles/
│ └── globals.css (if present)
├── supabase/ (project metadata/config)
│ └── … (if used)
├── tailwind.config.js
├── tsconfig.json
└── dist/ (build output)

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

Any static assets, like images, can be placed in the `public/` directory.

src/data/resources/items is the canonical store; run scripts/build-resources.mjs to regenerate resources.json if needed.

scripts/generate-notes.mjs can fill per-item notes from URLs.

Favicons in public/ include SVGs and Safari mask; SVGs are preferred in Base.astro.

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

URL:
https://example.com/your-article

---

You are a precise metadata extractor and filename generator for the BFSI Insights knowledge base.

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
