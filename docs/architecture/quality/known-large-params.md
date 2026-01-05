# Known Large Parameter Counts

Snapshot of units that exceed parameter-count guidelines.

- Blocking threshold: >= 6 params, or > 7 destructured keys (treated as too many parameters)

```text
 Count | File                                                  | Unit
 ----- | ----------------------------------------------------- | -------------------
 6     | apps/web/features/publications/multi-filters/chips.ts | updateFilterChips
 6     | services/agent-api/src/lib/discovery-scoring.js       | processCandidates
 6     | services/agent-api/src/lib/discovery-scoring.js       | scoreCandidate
 6     | services/agent-api/src/lib/pipeline-tracking.js       | logFailure
```
