# Large Functions Report

> Auto-generated on 2026-01-07 by nightly quality workflow

Functions exceeding size limits (source: 30 lines, test: 50 lines)

## Summary

- **Total large functions:** 55
- **Files affected:** 47

## Functions

```text
LINES  FUNCTION                  FILE
-----  ------------------------  --------------------------------------------------------------------------------
   90  LoginPage()               apps/admin/src/app/(auth)/login/page.tsx
   85  AgentDetailPage()         apps/admin/src/app/(dashboard)/agents/[agent]/page.tsx
   77  initMultiSelectFilters()  apps/web/features/publications/multi-select-filters.impl.ts
   73  Sidebar()                 apps/admin/src/components/ui/sidebar.tsx
   72  usePromptActions()        apps/admin/src/app/(dashboard)/agents/[agent]/hooks/usePromptActions.ts
   71  MissedDiscoveryPage()     apps/admin/src/app/(dashboard)/missed/page.tsx
   71  applyFilters()            apps/web/features/publications/filters/apply.ts
   69  useKeyboardShortcuts()    …admin/src/app/(dashboard)/items/components/detail-panel/useKeyboardShortcuts.ts
   69  testPdfExtraction()       services/agent-api/tests/lib/pdf-extraction.test.js
   66  GET()                     apps/admin/src/app/api/pipeline-status/route.ts
   61  main()                    services/agent-api/src/cli.js
   59  createTrace()             services/agent-api/src/lib/tracing.js
   57  parseRSS()                services/agent-api/src/lib/discovery-rss.js
   56  SearchBar()               apps/admin/src/app/(dashboard)/items/search-bar.tsx
   52  AgentsPage()              apps/admin/src/app/(dashboard)/agents/page.tsx
   51  usePipelineActions()      apps/admin/src/components/ui/sidebar/usePipelineActions.ts
   51  main()                    services/agent-api/src/scripts/backfill-tags.js
   49  parseStructured()         services/agent-api/src/lib/llm.js
   48  completeAnthropic()       services/agent-api/src/lib/llm.js
   47  readFromQuery()           apps/web/features/publications/filters/storage.ts
   46  useComparison()           apps/admin/src/app/(dashboard)/evals/head-to-head/hooks/useComparison.ts
   46  enhanceImages()           apps/web/features/publications/image-enhancement.ts
   45  POST()                    apps/admin/src/app/api/evals/head-to-head/route.ts
   44  updateSession()           apps/admin/src/lib/supabase/middleware.ts
   44  calculateQualityScore()   services/agent-api/src/lib/quality-scorer.js
   43  GET()                     apps/admin/src/app/api/dashboard/stats/route.ts
   43  POST()                    apps/admin/src/app/api/test-prompt/route.ts
   43  if()                      apps/web/components/BackToTopButton.astro
   41  handleLlmScoring()        services/agent-api/src/lib/discovery-scoring.js
   40  validateForm()            apps/admin/src/app/(dashboard)/add/handlers/validateForm.ts
   39  getQueueItem()            apps/admin/src/app/(dashboard)/items/[id]/data-loaders.ts
   39  POST()                    apps/admin/src/app/api/entities/route.ts
   39  createCallbackCreators()  apps/web/features/publications/multi-select-filters.handlers.ts
   38  renderSearchHistory()     apps/web/features/publications/filters/search.ts
   38  runRelevanceFilter()      services/agent-api/src/agents/screener.js
   38  handleEmbeddingScoring()  services/agent-api/src/lib/discovery-scoring.js
   37  useDetailPanelData()      …s/admin/src/app/(dashboard)/items/components/detail-panel/useDetailPanelData.ts
   37  toggleCard()              apps/web/features/publications/card-expand.ts
   37  loadFilters()             apps/web/features/publications/multi-filters/state.ts
   36  useResizablePanel()       apps/admin/src/app/(dashboard)/agents/hooks/useResizablePanel.ts
   36  POST()                    apps/admin/src/app/api/evals/llm-judge/route.ts
   36  updateParentState()       apps/web/features/publications/hierarchy-cascade.ts
   36  parseArgs()               services/agent-api/src/cli/utils.js
   36  buildPremiumPayload()     services/agent-api/src/lib/premium-handler.js
   36  traceLLMCall()            services/agent-api/src/lib/tracing.js
   34  useAgentPrompts()         apps/admin/src/app/(dashboard)/agents/[agent]/hooks/useAgentPrompts.ts
   34  initHierarchyCascade()    apps/web/features/publications/hierarchy-cascade.ts
   33  POST()                    apps/admin/src/app/api/process-queue/route.ts
   33  processCandidate()        services/agent-api/src/lib/discovery-scoring.js
   32  GET()                     apps/admin/src/app/api/queue-item/[id]/route.ts
   32  extractRssPreview()       services/agent-api/src/lib/premium-handler.js
   32  enrichWithCitations()     services/agent-api/src/lib/quality-scorer.js
   31  useAgentCoverageStats()   apps/admin/src/app/(dashboard)/agents/use-agent-coverage-stats.ts
   31  useSidebarEffects()       apps/admin/src/components/ui/sidebar/useSidebarEffects.ts
   31  completeOpenAI()          services/agent-api/src/lib/llm.js
```
