# Large Functions Report

> Auto-generated on 2026-01-05 by nightly quality workflow

Functions exceeding size limits (source: 30 lines, test: 50 lines)

## Summary

- **Total large functions:** 87
- **Files affected:** 71

## Functions

| File                                                                                   | Function                       | Lines | Limit | Location |
| -------------------------------------------------------------------------------------- | ------------------------------ | ----: | ----: | -------- |
| `apps/admin/src/app/(dashboard)/evals/ab-tests/page.tsx`                               | `ABTestsPage()`                |   207 |    30 | L9-215   |
| `apps/admin/src/app/(dashboard)/add/hooks/useAddArticle.ts`                            | `useAddArticle()`              |   201 |    30 | L8-208   |
| `apps/admin/src/app/(dashboard)/agents/page.tsx`                                       | `AgentsPage()`                 |   152 |    30 | L11-162  |
| `apps/admin/src/components/dashboard/DiscoveryControlCard.tsx`                         | `DiscoveryControlCard()`       |   142 |    30 | L12-153  |
| `apps/web/features/publications/multi-select-filters.apply.ts`                         | `createApplyFiltersFunction()` |   135 |    30 | L19-153  |
| `services/agent-api/src/lib/taxonomy-loader.js`                                        | `loadTaxonomies()`             |   132 |    30 | L31-162  |
| `services/agent-api/src/agents/discover-classics.js`                                   | `runClassicsDiscovery()`       |   115 |    30 | L194-308 |
| `services/agent-api/src/lib/scrapers.js`                                               | `scrapeWebsite()`              |   107 |    30 | L19-125  |
| `apps/admin/src/app/(dashboard)/agents/hooks/usePrompts.ts`                            | `usePrompts()`                 |   104 |    30 | L8-111   |
| `services/agent-api/src/scripts/backfill-summaries.js`                                 | `main()`                       |    99 |    30 | L20-118  |
| `apps/admin/src/app/api/enrich-step/route.ts`                                          | `POST()`                       |    93 |    30 | L19-111  |
| `services/agent-api/src/scripts/backfill-dates.js`                                     | `main()`                       |    92 |    30 | L20-111  |
| `apps/admin/src/app/(auth)/login/page.tsx`                                             | `LoginPage()`                  |    90 |    30 | L7-96    |
| `services/agent-api/src/agents/summarizer.js`                                          | `runSummarizer()`              |    90 |    30 | L195-284 |
| `apps/admin/src/app/(dashboard)/agents/[agent]/page.tsx`                               | `AgentDetailPage()`            |    85 |    30 | L13-97   |
| `services/agent-api/src/scripts/validate-agent-registry.js`                            | `main()`                       |    80 |    30 | L64-143  |
| `apps/web/features/publications/multi-select-filters.impl.ts`                          | `initMultiSelectFilters()`     |    77 |    30 | L23-99   |
| `apps/admin/src/components/ui/sidebar.tsx`                                             | `Sidebar()`                    |    73 |    30 | L53-125  |
| `apps/admin/src/app/(dashboard)/agents/[agent]/hooks/usePromptActions.ts`              | `usePromptActions()`           |    72 |    30 | L4-75    |
| `apps/admin/src/app/(dashboard)/missed/page.tsx`                                       | `MissedDiscoveryPage()`        |    71 |    30 | L9-79    |
| `apps/web/features/publications/filters/apply.ts`                                      | `applyFilters()`               |    71 |    30 | L5-75    |
| `services/agent-api/src/lib/prompt-eval.js`                                            | `runPromptEval()`              |    71 |    30 | L180-250 |
| `apps/admin/src/app/(dashboard)/items/components/detail-panel/useKeyboardShortcuts.ts` | `useKeyboardShortcuts()`       |    69 |    30 | L16-84   |
| `services/agent-api/src/lib/discovery-config.js`                                       | `loadDiscoveryConfig()`        |    69 |    30 | L35-103  |
| `services/agent-api/tests/lib/pdf-extraction.test.js`                                  | `testPdfExtraction()`          |    69 |    50 | L17-85   |
| `apps/admin/src/app/api/pipeline-status/route.ts`                                      | `GET()`                        |    66 |    30 | L6-71    |
| `apps/web/lib/publications-data.ts`                                                    | `loadPublicationsData()`       |    66 |    30 | L94-159  |
| `services/agent-api/src/cli.js`                                                        | `main()`                       |    61 |    30 | L33-93   |
| `apps/web/pages/login.astro`                                                           | `if()`                         |    60 |    30 | L84-143  |
| `services/agent-api/src/lib/tracing.js`                                                | `createTrace()`                |    59 |    30 | L67-125  |
| `services/agent-api/src/lib/discovery-rss.js`                                          | `parseRSS()`                   |    57 |    30 | L40-96   |
| `apps/admin/src/app/(dashboard)/items/search-bar.tsx`                                  | `SearchBar()`                  |    56 |    30 | L6-61    |
| `services/agent-api/src/lib/embeddings.js`                                             | `buildReferenceEmbedding()`    |    52 |    30 | L114-165 |
| `apps/admin/src/components/ui/sidebar/usePipelineActions.ts`                           | `usePipelineActions()`         |    51 |    30 | L5-55    |
| `services/agent-api/src/scripts/backfill-tags.js`                                      | `main()`                       |    51 |    30 | L106-156 |
| `services/agent-api/src/lib/llm.js`                                                    | `parseStructured()`            |    49 |    30 | L183-231 |
| `services/agent-api/src/lib/llm.js`                                                    | `completeAnthropic()`          |    48 |    30 | L123-170 |
| `apps/web/features/publications/filters/storage.ts`                                    | `readFromQuery()`              |    47 |    30 | L47-93   |
| `apps/admin/src/app/(dashboard)/evals/head-to-head/hooks/useComparison.ts`             | `useComparison()`              |    46 |    30 | L23-68   |
| `apps/web/features/publications/image-enhancement.ts`                                  | `enhanceImages()`              |    46 |    30 | L8-53    |
| `services/agent-api/src/cli/commands/eval.js`                                          | `runEvalCmd()`                 |    46 |    30 | L15-60   |
| `services/agent-api/src/cli/commands/health.js`                                        | `runQueueHealthCmd()`          |    46 |    30 | L11-56   |
| `apps/admin/src/app/api/evals/head-to-head/route.ts`                                   | `POST()`                       |    45 |    30 | L8-52    |
| `apps/admin/src/lib/supabase/middleware.ts`                                            | `updateSession()`              |    44 |    30 | L4-47    |
| `services/agent-api/src/agents/discover-classics.js`                                   | `queuePaper()`                 |    44 |    30 | L122-165 |
| `services/agent-api/src/lib/discovery-queue.js`                                        | `checkExists()`                |    44 |    30 | L34-77   |
| `services/agent-api/src/lib/quality-scorer.js`                                         | `calculateQualityScore()`      |    44 |    30 | L79-122  |
| `apps/admin/src/app/api/dashboard/stats/route.ts`                                      | `GET()`                        |    43 |    30 | L8-50    |
| `apps/admin/src/app/api/test-prompt/route.ts`                                          | `POST()`                       |    43 |    30 | L8-50    |
| `apps/web/components/BackToTopButton.astro`                                            | `if()`                         |    43 |    30 | L30-72   |
| `services/agent-api/src/lib/vendor-loader.js`                                          | `loadVendors()`                |    42 |    30 | L17-58   |
| `apps/web/lib/publications-data.ts`                                                    | `createValuesWithCounts()`     |    41 |    30 | L52-92   |
| `services/agent-api/src/lib/discovery-scoring.js`                                      | `handleLlmScoring()`           |    41 |    30 | L117-157 |
| `apps/admin/src/app/(dashboard)/add/handlers/validateForm.ts`                          | `validateForm()`               |    40 |    30 | L13-52   |
| `apps/admin/src/app/(dashboard)/items/[id]/data-loaders.ts`                            | `getQueueItem()`               |    39 |    30 | L9-47    |
| `apps/admin/src/app/api/entities/route.ts`                                             | `POST()`                       |    39 |    30 | L18-56   |
| `apps/web/features/publications/multi-select-filters.handlers.ts`                      | `createCallbackCreators()`     |    39 |    30 | L139-177 |
| `apps/web/pages/index.astro`                                                           | `enhanceImages()`              |    39 |    30 | L218-256 |
| `apps/web/features/publications/filters/search.ts`                                     | `renderSearchHistory()`        |    38 |    30 | L24-61   |
| `services/agent-api/src/agents/screener.js`                                            | `runRelevanceFilter()`         |    38 |    30 | L5-42    |
| `services/agent-api/src/lib/discovery-queue.js`                                        | `insertToQueue()`              |    38 |    30 | L121-158 |
| `services/agent-api/src/lib/discovery-scoring.js`                                      | `handleEmbeddingScoring()`     |    38 |    30 | L75-112  |
| `apps/admin/src/app/(dashboard)/items/components/detail-panel/useDetailPanelData.ts`   | `useDetailPanelData()`         |    37 |    30 | L11-47   |
| `apps/web/features/publications/card-expand.ts`                                        | `toggleCard()`                 |    37 |    30 | L6-42    |
| `apps/web/features/publications/multi-filters/state.ts`                                | `loadFilters()`                |    37 |    30 | L53-89   |
| `apps/admin/src/app/(dashboard)/agents/hooks/useResizablePanel.ts`                     | `useResizablePanel()`          |    36 |    30 | L5-40    |
| `apps/admin/src/app/api/evals/llm-judge/route.ts`                                      | `POST()`                       |    36 |    30 | L7-42    |
| `apps/web/features/publications/hierarchy-cascade.ts`                                  | `updateParentState()`          |    36 |    30 | L55-90   |
| `services/agent-api/src/cli/utils.js`                                                  | `parseArgs()`                  |    36 |    30 | L12-47   |
| `services/agent-api/src/lib/premium-handler.js`                                        | `buildPremiumPayload()`        |    36 |    30 | L132-167 |
| `services/agent-api/src/lib/tracing.js`                                                | `traceLLMCall()`               |    36 |    30 | L139-174 |
| `services/agent-api/src/lib/discovery-queue.js`                                        | `retryRejected()`              |    35 |    30 | L82-116  |
| `apps/admin/src/app/(dashboard)/agents/[agent]/hooks/useAgentPrompts.ts`               | `useAgentPrompts()`            |    34 |    30 | L5-38    |
| `apps/web/features/publications/hierarchy-cascade.ts`                                  | `initHierarchyCascade()`       |    34 |    30 | L10-43   |
| `apps/web/pages/index.astro`                                                           | `initAudienceFilter()`         |    34 |    30 | L173-206 |
| `services/agent-api/src/agents/orchestrator.js`                                        | `processQueue()`               |    34 |    30 | L129-162 |
| `services/agent-api/src/lib/prompt-eval.js`                                            | `runExamples()`                |    34 |    30 | L113-146 |
| `services/agent-api/src/routes/evals.js`                                               | `for()`                        |    34 |    30 | L144-177 |
| `apps/admin/src/app/api/process-queue/route.ts`                                        | `POST()`                       |    33 |    30 | L6-38    |
| `services/agent-api/src/agents/orchestrator.js`                                        | `enrichItem()`                 |    33 |    30 | L95-127  |
| `services/agent-api/src/lib/discovery-scoring.js`                                      | `processCandidate()`           |    33 |    30 | L15-47   |
| `apps/admin/src/app/api/queue-item/[id]/route.ts`                                      | `GET()`                        |    32 |    30 | L6-37    |
| `services/agent-api/src/lib/premium-handler.js`                                        | `extractRssPreview()`          |    32 |    30 | L92-123  |
| `services/agent-api/src/lib/quality-scorer.js`                                         | `enrichWithCitations()`        |    32 |    30 | L129-160 |
| `apps/admin/src/components/ui/sidebar/useSidebarEffects.ts`                            | `useSidebarEffects()`          |    31 |    30 | L3-33    |
| `services/agent-api/src/lib/llm.js`                                                    | `completeOpenAI()`             |    31 |    30 | L88-118  |
| `services/agent-api/src/lib/prompt-eval.js`                                            | `createEvalRun()`              |    31 |    30 | L78-108  |
