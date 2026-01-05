# Known Large Parameter Counts

Snapshot of units that exceed parameter-count guidelines.

- Blocking threshold: >= 6 params, or > 7 destructured keys (treated as too many parameters)

```text
 Count | File                                                  | Unit
 ----- | ----------------------------------------------------- | -------------------
 7     | services/agent-api/src/agents/thumbnailer.js          | processPdf
 7     | services/agent-api/src/agents/thumbnailer.js          | storePdf
 7     | services/agent-api/src/agents/thumbnailer.js          | uploadThumbnail
 6     | apps/web/features/publications/multi-filters/chips.ts | updateFilterChips
 6     | services/agent-api/src/agents/thumbnailer.js          | loadAndPreparePage
 6     | services/agent-api/src/agents/thumbnailer.js          | uploadScreenshot
 6     | services/agent-api/src/lib/discovery-scoring.js       | processCandidates
 6     | services/agent-api/src/lib/discovery-scoring.js       | scoreCandidate
 6     | services/agent-api/src/lib/pipeline-tracking.js       | logFailure
```
