# Orchestration Architecture Analysis

> **Date:** 2026-01-12  
> **Purpose:** Analyze current agent/orchestration architecture and propose improvements based on best practices

## 1. Agent Statefulness Audit

### Current State

| Agent           | File                | Stateless? | Hidden State | Notes                                |
| --------------- | ------------------- | ---------- | ------------ | ------------------------------------ |
| **summarizer**  | `summarizer.js`     | ✅ Yes     | None         | Pure input→output via AgentRunner    |
| **tagger**      | `tagger.js`         | ✅ Yes     | None         | Loads taxonomies fresh each run      |
| **thumbnailer** | `thumbnailer.js`    | ✅ Yes     | None         | Browser launched per-run, cleaned up |
| **screener**    | `screener.js`       | ✅ Yes     | None         | Pure LLM call                        |
| **scorer**      | `scorer.js`         | ✅ Yes     | None         | Pure scoring with pre-filters        |
| **discoverer**  | `discoverer-run.js` | ✅ Yes     | None         | Config loaded fresh each run         |

### AgentRunner Class

The `AgentRunner` class (`lib/runner.js`) has instance state:

- `runId` - scoped to single run
- `stepOrder` - reset at start of each run
- `promptVersionId` - loaded per run
- `trace` - LangSmith trace, per run

**Assessment:** This is acceptable **short-lived in-process scratchpad** state. It doesn't survive restarts and is scoped to the run lifecycle.

### Module-Level Caches

Several modules use lazy-initialized singletons:

| Module            | Cache                    | Concern?                            |
| ----------------- | ------------------------ | ----------------------------------- |
| `status-codes.js` | `statusCache`            | ⚠️ Cached forever, but recomputable |
| `queue-update.js` | `supabaseClient`         | ✅ OK - connection pool             |
| `runner.js`       | `_supabase` per instance | ✅ OK - per runner                  |
| `orchestrator.js` | `supabase`               | ✅ OK - connection pool             |

**Finding:** Status codes are cached forever but this is acceptable since:

1. They're loaded from DB on first use
2. They're recomputable (restart clears cache)
3. Status codes rarely change in production

### Verdict: Agents Are Stateless ✅

All agents follow the stateless pattern:

- **Input:** Explicit payload (queueItem, options)
- **Output:** Explicit result (structured data, evidence)
- **No hidden memory** required for correctness on replay

---

## 2. Current Orchestration Architecture

### Orchestration Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        Admin UI (Next.js)                        │
│  - Process Queue button → /api/process-queue                    │
│  - Re-enrich button → /api/enrich-item                          │
│  - Single step buttons → /api/enrich-step                       │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Agent API (Express)                          │
│  /api/agents/process-queue  → orchestrator.processQueue()       │
│  /api/agents/enrich-item    → orchestrator.enrichItem()         │
│  /api/agents/enrich-single-step → step-specific orchestration   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   orchestrator.js (Thin Layer)                   │
│  - Owns: step sequencing, retry logic (MAX_FETCH_ATTEMPTS=3)    │
│  - Calls: stepFetch → stepFilter → stepSummarize → stepTag →    │
│           stepThumbnail                                          │
│  - State transitions via transitionByAgent() RPC                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Individual Agents                          │
│  summarizer, tagger, thumbnailer, screener, scorer              │
│  - Each uses AgentRunner for prompt loading, logging, metrics   │
│  - Returns structured result to orchestrator                    │
└─────────────────────────────────────────────────────────────────┘
```

### State Storage

| What                   | Where                                           | Purpose                       |
| ---------------------- | ----------------------------------------------- | ----------------------------- |
| **Workflow state**     | `ingestion_queue.status_code`                   | Current position in pipeline  |
| **Valid transitions**  | `state_transitions` table                       | Enforced by DB trigger        |
| **Transition history** | `status_history` table                          | Audit trail                   |
| **Run tracking**       | `pipeline_run` table                            | Cost tracking, run lifecycle  |
| **Step tracking**      | `pipeline_step_run` table                       | Per-step metrics              |
| **Failure tracking**   | `ingestion_queue.failure_count`, `last_error_*` | Retry state                   |
| **Agent run logs**     | `agent_run`, `agent_run_step`                   | Detailed agent execution logs |

### Current Patterns

**Good:**

- ✅ State machine enforced at DB level (`enforce_state_transition` trigger)
- ✅ All transitions logged to `status_history`
- ✅ Agents are stateless and replayable
- ✅ Pipeline runs tracked for cost attribution

**Gaps:**

- ⚠️ No durable timers (retry after delay not supported)
- ⚠️ No parallelism support (steps are sequential)
- ⚠️ No workflow versioning (can't roll back workflow logic)
- ⚠️ Human approval is implicit (status 300 → manual action → 400)
- ⚠️ No compensation/rollback on partial failures

---

## 3. Workflow Mapping

### Primary Workflow: Discovery → Publish

```
Discovery Phase (100s)
  100 discovered
   ↓
  110 to_fetch → 111 fetching → 112 fetched
   ↓
  120 to_score → 121 scoring → 122 scored
   ↓
Enrichment Phase (200s)
  200 pending_enrichment
   ↓
  210 to_summarize → 211 summarizing → 212 summarized
   ↓
  220 to_tag → 221 tagging → 222 tagged
   ↓
  230 to_thumbnail → 231 thumbnailing → 232 thumbnailed
   ↓
  240 enriched
   ↓
Review Phase (300s)
  300 pending_review → 310 in_review → 320 editing
   ↓
Publication Phase (400s)
  400 published → 410 updated
   ↓
Terminal States (500s)
  500 failed, 510 unreachable, 520 duplicate, 530 irrelevant, 540 rejected, 599 dead_letter
```

### Failure Modes

| Failure                | Current Handling                         | Improvement Needed?              |
| ---------------------- | ---------------------------------------- | -------------------------------- |
| **Fetch failure**      | Retry up to 3x, then → 500               | ✅ OK                            |
| **LLM API error**      | Immediate failure → 500                  | ⚠️ Could use exponential backoff |
| **Thumbnail failure**  | Non-fatal, continues                     | ✅ OK                            |
| **Invalid transition** | DB trigger blocks                        | ✅ OK                            |
| **Partial enrichment** | No rollback, stuck in intermediate state | ⚠️ Need compensation             |

### Human Approval Gates

| Gate          | Status        | Current UX               |
| ------------- | ------------- | ------------------------ |
| **Review**    | 300 → 400     | Admin clicks "Approve"   |
| **Reject**    | 300 → 540     | Admin clicks "Reject"    |
| **Re-enrich** | 300/400 → 200 | Admin clicks "Re-enrich" |

---

## 4. Recommended Orchestration Pattern

Based on the analysis and the advice provided, the recommended pattern is:

### Pattern: Deterministic Outer Loop + Agent Inner Loop

```
┌─────────────────────────────────────────────────────────────────┐
│              Workflow Engine (Deterministic)                     │
│  - State machine transitions (already in DB)                    │
│  - Retry policy with backoff                                    │
│  - Timeout handling                                             │
│  - Human approval gates                                         │
│  - Idempotency keys per step                                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Agent Steps (LLM)                             │
│  - Pure input → output                                          │
│  - Return structured result + evidence                          │
│  - No side effects except explicit outputs                      │
└─────────────────────────────────────────────────────────────────┘
```

### Minimal State Model

The current state model is already good. Proposed additions:

```sql
-- Add to ingestion_queue
ALTER TABLE ingestion_queue ADD COLUMN IF NOT EXISTS
  idempotency_key text,           -- For deduplication
  retry_after timestamptz,        -- Durable timer for delayed retry
  step_attempt integer DEFAULT 1; -- Current step attempt number

-- Add retry policy table
CREATE TABLE retry_policy (
  step_name text PRIMARY KEY,
  max_attempts integer DEFAULT 3,
  base_delay_seconds integer DEFAULT 60,
  backoff_multiplier numeric DEFAULT 2.0
);
```

### What NOT to Change

1. **Keep agents stateless** - working well
2. **Keep DB-enforced state machine** - working well
3. **Keep orchestrator.js as thin layer** - just add retry/timeout logic
4. **Don't add LangGraph yet** - overkill for current workflow complexity

---

## 5. User Stories for Improvement

### Epic: Orchestration Resilience

#### US-1: Exponential Backoff for LLM Failures

**As a** system operator  
**I want** LLM API failures to retry with exponential backoff  
**So that** temporary outages don't cause permanent failures

**Acceptance Criteria:**

- [ ] Configurable retry policy per agent (max attempts, base delay, multiplier)
- [ ] Delays: 60s → 120s → 240s (configurable)
- [ ] After max retries, transition to `failed` with clear error message
- [ ] Retry attempts visible in `pipeline_step_run`

**Files to modify:**

- `services/agent-api/src/lib/runner.js` - add retry wrapper
- `services/agent-api/src/agents/orchestrator.js` - use retry wrapper
- New table: `retry_policy`

---

#### US-2: Idempotent Step Execution

**As a** system operator  
**I want** agent steps to be idempotent  
**So that** retries don't cause duplicate work or corrupt data

**Acceptance Criteria:**

- [ ] Each step execution has a unique idempotency key
- [ ] Re-running same key returns cached result
- [ ] Key format: `{queue_id}:{step}:{attempt}`
- [ ] Results cached in `pipeline_step_run.output`

**Files to modify:**

- `services/agent-api/src/lib/pipeline-step-runs.js`
- `services/agent-api/src/agents/enrichment-steps.js`

---

#### US-3: Durable Retry Timers

**As a** system operator  
**I want** failed items to automatically retry after a delay  
**So that** I don't need to manually trigger retries

**Acceptance Criteria:**

- [ ] Failed items get `retry_after` timestamp set
- [ ] Background job picks up items where `retry_after < now()`
- [ ] Respects max retry count before going to `dead_letter`
- [ ] Visible in admin UI: "Retry scheduled for X"

**Files to modify:**

- `infra/supabase/migrations/` - add `retry_after` column
- `services/agent-api/src/agents/orchestrator.js` - set retry_after on failure
- New: `services/agent-api/src/jobs/retry-scheduler.js`

---

#### US-4: Compensation on Partial Failure

**As a** system operator  
**I want** partial enrichment failures to be recoverable  
**So that** items don't get stuck in intermediate states

**Acceptance Criteria:**

- [ ] If summarize succeeds but tag fails, item can resume from `to_tag`
- [ ] Payload preserves partial results
- [ ] Clear "resume from step X" action in admin UI
- [ ] No duplicate LLM calls for completed steps

**Files to modify:**

- `services/agent-api/src/agents/orchestrator.js` - checkpoint after each step
- `apps/admin/src/app/(dashboard)/items/[id]/enrichment-panel/` - resume UI

---

#### US-5: Explicit Human Approval Tracking

**As a** reviewer  
**I want** my approval/rejection to be explicitly tracked  
**So that** there's a clear audit trail of who approved what

**Acceptance Criteria:**

- [ ] `reviewed_by` populated on approve/reject
- [ ] `reviewed_at` timestamp set
- [ ] Approval reason/notes captured
- [ ] Visible in item history

**Files to modify:**

- `apps/admin/src/app/(dashboard)/items/[id]/review-actions/` - add notes field
- `infra/supabase/migrations/` - add `review_notes` column if needed

---

#### US-6: Workflow Observability Dashboard

**As a** system operator  
**I want** a dashboard showing workflow health  
**So that** I can quickly identify bottlenecks and failures

**Acceptance Criteria:**

- [ ] Items per status (bar chart)
- [ ] Failure rate per step (last 24h)
- [ ] Average time per step
- [ ] Items stuck > 1 hour
- [ ] Retry queue depth

**Files to create:**

- `apps/admin/src/app/(dashboard)/workflows/` - new dashboard page

---

### Epic: Future Considerations (Not Now)

#### US-F1: Parallel Enrichment Steps

**As a** system operator  
**I want** tag and thumbnail to run in parallel  
**So that** enrichment completes faster

**Status:** Deferred - requires workflow engine changes

---

#### US-F2: Workflow Versioning

**As a** system operator  
**I want** workflow changes to be versioned  
**So that** I can roll back problematic changes

**Status:** Deferred - requires significant infrastructure

---

## 6. Implementation Priority

| Priority | User Story                       | Effort | Impact                             |
| -------- | -------------------------------- | ------ | ---------------------------------- |
| **P1**   | US-1: Exponential Backoff        | Medium | High - reduces manual intervention |
| **P1**   | US-2: Idempotent Steps           | Medium | High - enables safe retries        |
| **P2**   | US-3: Durable Retry Timers       | High   | Medium - automation                |
| **P2**   | US-4: Partial Failure Recovery   | Medium | Medium - UX improvement            |
| **P3**   | US-5: Explicit Approval Tracking | Low    | Low - audit trail                  |
| **P3**   | US-6: Workflow Dashboard         | High   | Medium - observability             |

---

## 7. Decision Record

### Decision: Keep Custom Orchestrator, Don't Adopt LangGraph/Temporal

**Context:** Should we adopt a workflow engine like LangGraph, Temporal, or AWS Step Functions?

**Decision:** No, keep custom orchestrator for now.

**Rationale:**

1. Current workflow is simple and linear (no complex branching)
2. State machine is already enforced at DB level
3. Adding a workflow engine would require:
   - New infrastructure (Temporal server, etc.)
   - Learning curve for team
   - Migration of existing items
4. Custom orchestrator is sufficient with small improvements (retry, idempotency)

**Revisit when:**

- Workflow becomes more complex (parallel steps, conditional branching)
- Need durable timers > 24 hours
- Need workflow versioning with migration

---

## 8. Conclusion

The current architecture is **sound** and follows good practices:

- ✅ Agents are stateless
- ✅ State machine is DB-enforced
- ✅ Transitions are logged
- ✅ Single orchestrator layer

**Recommended improvements** (in order):

1. Add exponential backoff for LLM failures
2. Make steps idempotent
3. Add durable retry timers
4. Improve partial failure recovery
5. Add workflow observability dashboard

These improvements can be made incrementally without major architectural changes.
