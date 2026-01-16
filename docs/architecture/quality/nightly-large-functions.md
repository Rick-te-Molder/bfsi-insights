# Large Functions Report

> Auto-generated on 2026-01-16 by nightly quality workflow

Functions exceeding size limits (source: 30 lines, test: 50 lines)

## Summary

- **Total large functions:** 33
- **Files affected:** 30

## Functions

```text
LINES  FUNCTION                        FILE
-----  ------------------------------  --------------------------------------------------------------------------------
   95  scrollToLikelyArticleContent()  services/agent-api/src/agents/thumbnailer-browser.js
   47  readFromQuery()                 apps/web/features/publications/filters/storage.ts
   46  useComparison()                 apps/admin/src/app/(dashboard)/evals/head-to-head/hooks/useComparison.ts
   46  enhanceImages()                 apps/web/features/publications/image-enhancement.ts
   45  POST()                          apps/admin/src/app/api/evals/head-to-head/route.ts
   44  POST()                          apps/admin/src/app/api/process-queue/route.ts
   44  updateSession()                 apps/admin/src/lib/supabase/middleware.ts
   44  calculateQualityScore()         services/agent-api/src/lib/quality-scorer.js
   43  GET()                           apps/admin/src/app/api/dashboard/stats/route.ts
   43  POST()                          apps/admin/src/app/api/test-prompt/route.ts
   43  if()                            apps/web/components/BackToTopButton.astro
   40  validateForm()                  apps/admin/src/app/(dashboard)/add/handlers/validateForm.ts
   39  POST()                          apps/admin/src/app/api/entities/route.ts
   39  createCallbackCreators()        apps/web/features/publications/multi-select-filters.handlers.ts
   38  renderSearchHistory()           apps/web/features/publications/filters/search.ts
   38  runRelevanceFilter()            services/agent-api/src/agents/screener.js
   37  useDetailPanelData()            …s/admin/src/app/(dashboard)/items/components/detail-panel/useDetailPanelData.ts
   37  toggleCard()                    apps/web/features/publications/card-expand.ts
   37  loadFilters()                   apps/web/features/publications/multi-filters/state.ts
   36  useResizablePanel()             apps/admin/src/app/(dashboard)/agents/hooks/useResizablePanel.ts
   36  POST()                          apps/admin/src/app/api/evals/llm-judge/route.ts
   36  updateParentState()             apps/web/features/publications/hierarchy-cascade.ts
   36  parseArgs()                     services/agent-api/src/cli/utils.js
   36  buildPremiumPayload()           services/agent-api/src/lib/premium-handler.js
   34  useAgentPrompts()               apps/admin/src/app/(dashboard)/agents/[agent]/hooks/useAgentPrompts.ts
   34  initHierarchyCascade()          apps/web/features/publications/hierarchy-cascade.ts
   34  fetchItems()                    services/agent-api/src/cli/commands/thumbnail.js
   32  GET()                           apps/admin/src/app/api/queue-item/[id]/route.ts
   32  extractRssPreview()             services/agent-api/src/lib/premium-handler.js
   32  enrichWithCitations()           services/agent-api/src/lib/quality-scorer.js
   31  useAgentCoverageStats()         apps/admin/src/app/(dashboard)/agents/use-agent-coverage-stats.ts
   31  useSidebarEffects()             apps/admin/src/components/ui/sidebar/useSidebarEffects.ts
   31  runThumbnailer()                services/agent-api/src/agents/thumbnailer.js
```
