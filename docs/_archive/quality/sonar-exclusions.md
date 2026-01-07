# SonarCloud Coverage Exclusions

This document explains which files are excluded from coverage requirements in SonarCloud and why.

**Last updated:** 2025-11-30  
**Owner:** Rick te Molder

## 1. Principles

- **Exclusions are exceptions, not the default.**
- Only low-ROI or infrastructure/orchestration code is excluded.
- Business logic (filters, taxonomies, scoring, transformers) must remain in scope.
- Pure utility functions should be extracted and tested, even if wrappers are excluded.

## 2. Current Exclusions

| Pattern / File                                 | Reason                                                                                 | Decision Date | Review By  |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- | ------------- | ---------- |
| `services/agent-api/src/agents/discover.js`    | CLI/orchestration wrapper; pure logic extracted to separate modules                    | 2025-11-30    | 2026-03-31 |
| `services/agent-api/src/agents/enrich-item.js` | IO-heavy pipeline orchestration (fetch→filter→summarize→tag→thumbnail); tested via E2E | 2025-11-30    | 2026-03-31 |
| `**/lib/content-fetcher.js`                    | Shared fetch/retry/HTML-parsing infrastructure; IO-heavy, no business logic            | 2025-11-30    | 2026-03-31 |
| `**/scripts/**`                                | One-off backfill/migration scripts; not part of runtime application                    | 2025-11-30    | 2026-03-31 |
| `**/cli.js`                                    | CLI entry point; argument parsing and command routing only                             | 2025-11-30    | 2026-03-31 |
| `**/*.config.{js,ts}`                          | Tool configuration (Vitest, Tailwind, ESLint, etc.)                                    | 2025-11-30    | 2026-03-31 |
| `**/playwright.config.ts`                      | E2E test runner configuration                                                          | 2025-11-30    | 2026-03-31 |
| `**/e2e/**`                                    | E2E test files (tested separately via Playwright)                                      | 2025-11-30    | 2026-03-31 |
| `**/routes/**`                                 | Express route handlers; thin wrappers around agent logic                               | 2025-11-30    | 2026-03-31 |
| `services/agent-api/src/index.js`              | Express entry point; server bootstrap only                                             | 2025-12-01    | 2026-06-01 |
| `**/lib/runner.js`                             | Agent runner infrastructure; Supabase/OpenAI client setup                              | 2025-12-01    | 2026-06-01 |
| `**/lib/evals.js`                              | Eval orchestration; pure helpers extracted to `eval-helpers.js`                        | 2025-12-01    | 2026-06-01 |
| `**/lib/scrapers.js`                           | Web scraping infrastructure; Playwright browser automation                             | 2025-12-02    | 2026-06-02 |
| `**/lib/embeddings.js`                         | OpenAI embeddings + Supabase reference builder; pure math tested, infra excluded       | 2025-12-02    | 2026-06-02 |
| `**/agents/filter.js`                          | Thin LLM wrapper; AgentRunner orchestration                                            | 2025-12-02    | 2026-06-02 |
| `**/agents/summarize.js`                       | Thin LLM wrapper; AgentRunner orchestration                                            | 2025-12-02    | 2026-06-02 |
| `**/agents/thumbnail.js`                       | Thin LLM wrapper; screenshot/image processing                                          | 2025-12-02    | 2026-06-02 |
| `**/lib/pipeline-tracking.js`                  | Pipeline run/step tracking infrastructure; Supabase client calls only                  | 2025-12-16    | 2026-06-16 |
| `apps/web/pages/**`                            | Astro pages; DOM/SSR glue code                                                         | 2025-11-30    | 2026-03-31 |
| `apps/web/features/**`                         | UI components; DOM wiring (business logic extracted to `apps/web/lib/`)                | 2025-11-30    | 2026-03-31 |
| `apps/web/lib/admin/**`                        | Admin UI orchestration; DOM + Supabase client calls                                    | 2025-12-03    | 2026-06-03 |
| `**/pages/api/**`                              | Astro API routes; minimal glue code                                                    | 2025-11-30    | 2026-03-31 |

## 3. Files NOT Excluded (Business Logic)

These files contain core business logic and **must** have test coverage:

| File                                                   | Purpose                          | Test File                                        |
| ------------------------------------------------------ | -------------------------------- | ------------------------------------------------ |
| `apps/web/lib/filters.ts`                              | Publication filtering logic      | `apps/web/tests/lib/filters.spec.ts`             |
| `apps/web/lib/authors.ts`                              | Author normalization             | `apps/web/tests/lib/authors.spec.ts`             |
| `apps/web/lib/text.ts`                                 | Text utilities (linkify, escape) | `apps/web/tests/lib/text.spec.ts`                |
| `apps/web/lib/fmt.ts`                                  | Date formatting                  | `apps/web/tests/lib/fmt.spec.ts`                 |
| `services/agent-api/src/agents/discovery-relevance.js` | LLM relevance scoring logic      | `services/agent-api/tests/agents/scorer.spec.js` |
| `services/agent-api/src/lib/sitemap.js`                | Sitemap parsing                  | `services/agent-api/tests/lib/sitemap.spec.js`   |

## 4. Review Policy

- All Sonar coverage exclusions are reviewed **at least twice per year** (Q1 and Q3).
- When code structure changes significantly, affected exclusions should be re-evaluated.
- Any new exclusion requires a PR with clear rationale.

## 5. Configuration Location

All exclusions are defined in `sonar-project.properties` at the repository root.  
Do not configure exclusions in the SonarCloud UI—keep the single source of truth in version control.

## 6. Changelog

| Date       | Change                                                                   | Author         |
| ---------- | ------------------------------------------------------------------------ | -------------- |
| 2025-11-30 | Initial documentation of coverage exclusions                             | Rick te Molder |
| 2025-11-30 | Add pages/** and features/** - business logic extracted to apps/web/lib/ | Rick te Molder |
| 2025-11-30 | Add lib/content-fetcher.js - extracted from enrich-item.js               | Rick te Molder |
| 2025-12-01 | Add agent-api infrastructure: middleware, index.js, runner, tag.js       | Rick te Molder |
| 2025-12-02 | Add agent wrappers (filter, summarize, thumbnail, scrapers)              | Cascade        |
| 2025-12-02 | Document new tested files: discovery-relevance.js, embeddings.js         | Cascade        |
| 2025-12-03 | Add apps/web/lib/admin/\*\* - admin UI orchestration code                | Cascade        |
