# BFSI Insights

Agentic AI and other innovation related insights for executives and professionals in banking, financial services and insurance

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:
```
bfsi-insights/
├── astro.config.mjs
├── package.json
├── src/
│   ├── data/
│   │   ├── inbox/
│   │   │   └── urls.txt
│   │   └── resources/
│   │       └── items/
│   └── pages/
├── schemas/
│   └── kb.schema.json
├── scripts/
│   ├── add-url.mjs
│   └── ingest.mjs
└── node_modules/
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

Any static assets, like images, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

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
1) One line: FILENAME: <computed_filename.json>  
2) One JSON object only (no prose).

FILENAME RULE  
<year>_<slug>_<author-lastname>-<publisher-slug>[_v<version>].json  
- year = YYYY from date_published  
- slug = hyphenated, lowercase, from title  
- author-lastname = last name of first author, keep particles (e.g., van-der-waa)  
- publisher-slug = short slug from publisher name (e.g., mckinsey, ecb)  
- underscores between fields, hyphens within fields, all lowercase  

JSON KEYS (strictly per schema)
{
  "url": "canonical final URL",
  "title": "string",
  "slug": "lowercase-hyphenated title",
  "authors": ["Full Name", "..."],
  "source_name": "Publisher short name, e.g., McKinsey",
  "source_domain": "Publisher domain, e.g., mckinsey.com",
  "date_published": "YYYY-MM-DD",
  "date_added": "ISO 8601 datetime (now)",
  "last_edited": "ISO 8601 datetime (now)",
  "role": "executive | professional | academic",
  "industry": "one of: banking | banking-retail-banking | banking-corporate-banking | banking-lending | banking-payments | banking-deposits | banking-treasury | banking-capital-markets | banking-digital-banking | financial-services | financial-services-financial-advice | financial-services-wealth-management | financial-services-asset-management | financial-services-leasing | financial-services-factoring | financial-services-pension-funds | financial-services-insurance-brokerage | insurance | insurance-health-insurance | insurance-life-insurance | insurance-pension-insurance | insurance-property-and-casualty | cross-bfsi | cross-bfsi-infrastructure | cross-bfsi-shared-services | cross-bfsi-b2b-platforms",
  "topic": "one of: strategy-and-management | strategy-and-management-strategy | strategy-and-management-operating-models | strategy-and-management-transformation | strategy-and-management-case-studies | ecosystem | ecosystem-vendors | ecosystem-institutions | ecosystem-bfsi-sector | ecosystem-ai-industry | governance-and-control | governance-and-control-governance | governance-and-control-risk-management | governance-and-control-compliance | governance-and-control-financial-crime-prevention | governance-and-control-financial-crime-prevention-kyc | governance-and-control-financial-crime-prevention-cdd | governance-and-control-financial-crime-prevention-aml | governance-and-control-financial-crime-prevention-fraud-detection | governance-and-control-financial-crime-prevention-sanctions-screening | governance-and-control-auditing | governance-and-control-internal-controls | regulatory-and-standards | regulatory-and-standards-regulation | regulatory-and-standards-standards | regulatory-and-standards-policy | regulatory-and-standards-guidance | technology-and-data | technology-and-data-ai | technology-and-data-agentic-engineering | technology-and-data-rag | technology-and-data-orchestration | technology-and-data-data-management | technology-and-data-infrastructure | technology-and-data-cybersecurity | technology-and-data-monitoring | methods-and-approaches | methods-and-approaches-methodology | methods-and-approaches-models | methods-and-approaches-best-practices",
  "use_cases": "one of: customer-onboarding | identity-verification | document-processing | transaction-monitoring | credit-assessment | fraud-detection | claims-handling | portfolio-analytics | regulatory-reporting | audit-support",
  "agentic_capabilities": "one of: reasoning | planning | memory | tool-use | collaboration | autonomy | evaluation | monitoring",
  "content_type": "one of: report | white-paper | peer-reviewed-paper | article | presentation | webinar | dataset | website | policy-document",
  "jurisdiction": "one of: eu | uk | us | nl | global | other",
  "note": "short free text",
  "id": "sha1(url) as 40-char lowercase hex"
}

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