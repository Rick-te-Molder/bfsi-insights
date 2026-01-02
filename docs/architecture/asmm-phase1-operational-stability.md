# ASMM Phase 1: Operational Stability

**Status:** Foundation  
**Goal:** The system behaves predictably under normal and failure conditions

---

## Overview

Phase 1 establishes the foundation for AI system maturity by ensuring operational stability. This phase focuses on predictable behavior, comprehensive logging, failure handling, and replay capabilities.

**Phase 0 Note:** Some components may be in "Phase 0" (prototype/demo stage) where basic requirements are not yet met. This is captured in the scoring rubric (0-25% = Not Started) rather than as a formal phase. The maturity model begins at Phase 1 (Operational Stability).

---

## Requirements

### 1. Workflow State Machine

**Goal:** Every workflow stage has explicit entry/exit conditions

#### Requirements

- ✅ **Every workflow stage has explicit entry/exit conditions**
  - Status: IMPLEMENTED
  - Implementation: `services/agent-api/src/lib/state-machine.js`
  - All pipeline stages defined with entry/exit conditions

- ✅ **State transitions are atomic (all-or-nothing)**
  - Status: IMPLEMENTED
  - Database transactions ensure atomicity
  - No partial state updates

- ⚠️ **Invalid state transitions are rejected (enforced by code)**
  - Status: PARTIAL
  - State machine validates transitions
  - Need to add explicit validation errors for invalid transitions

**Metric:** 100% of items have valid state at all times

- Current: ~95% (some edge cases in error handling)
- Target: 100%

---

### 2. Idempotency (Side-Effect Safety)

**Goal:** Running agent N times produces no duplicate side effects

#### Requirements

- ✅ **Duplicate requests are detected and deduplicated**
  - Status: IMPLEMENTED
  - Queue system prevents duplicate processing
  - `kb_queue` has unique constraints on URL

- ⚠️ **For deterministic agents: output is bit-identical**
  - Status: PARTIAL
  - Deterministic for non-LLM agents (fetcher, thumbnailer)
  - LLM agents (scorer, tagger, summarizer) are non-deterministic by nature

- ⚠️ **For probabilistic agents (LLMs): output is semantically equivalent to baseline**
  - Status: PARTIAL
  - No formal semantic equivalence testing
  - Manual spot-checking only

- ❌ **Duplicate requests are detected and deduplicated**
  - Status: NOT IMPLEMENTED
  - No deduplication at API level
  - Queue-level deduplication only

- ❌ **Partial failures can be safely retried**
  - Status: NOT IMPLEMENTED
  - Retry logic exists but not fully safe for all agents
  - Some agents may create duplicate data on retry

**Metric:** 0 duplicate side effects in 30-day window

- Current: Unknown (not measured)
- Target: 0 duplicates

**Metric (regulated decisions only):** Deterministic mode enforced (fixed seed, model version, temperature=0)

- Status: NOT APPLICABLE (no regulated decisions yet)

---

### 3. Event Logging & Auditability

**Goal:** Every state change is logged as immutable event

#### Requirements

- ✅ **Every state change is logged as immutable event**
  - Status: IMPLEMENTED
  - `kb_pipeline_run` and `kb_pipeline_step_run` tables track all state changes
  - Immutable event log

- ✅ **Events include: timestamp, actor (user/agent), input hash, output hash, reason**
  - Status: IMPLEMENTED
  - All events include timestamp, agent, input/output tracking
  - Reason captured in step metadata

- ⚠️ **Critical state can be reconstructed from event log + snapshots**
  - Status: PARTIAL
  - Event log is complete
  - No formal snapshot mechanism
  - Reconstruction possible but not tested

**Metric:** 100% of state changes have corresponding events

- Current: 100% (enforced by code)
- Target: 100%

**Note:** Full event sourcing (rebuild entire state from events) is optional; audit trail completeness is mandatory.

---

### 4. Failure Classification

**Goal:** Every error is classified: retryable vs. terminal

#### Requirements

- ⚠️ **Every error is classified: retryable vs. terminal**
  - Status: PARTIAL
  - Some error classification exists
  - Not comprehensive across all agents

- ⚠️ **Retryable errors: exponential backoff with jitter and max backoff**
  - Status: PARTIAL
  - Basic retry logic exists
  - No exponential backoff or jitter
  - Example: base=1s, max=60s, jitter=±20%

- ⚠️ **Rate limit errors (429): longer backoff (e.g., base=10s)**
  - Status: PARTIAL
  - 429 errors handled but not with special backoff
  - Target: base=10s for rate limits

- ❌ **Server errors (5xx): standard backoff**
  - Status: NOT IMPLEMENTED
  - No specific handling for 5xx errors
  - Should use standard backoff

- ❌ **Timeout errors: configurable based on downstream SLA**
  - Status: NOT IMPLEMENTED
  - Fixed timeouts, not configurable
  - No SLA-based timeout adjustment

- ❌ **Terminal errors go to dead-letter queue immediately**
  - Status: NOT IMPLEMENTED
  - No dead-letter queue
  - Failed items stay in main queue

**Metric:** <5% of failures are misclassified (measured by manual audit of DLQ)

- Current: Unknown (no DLQ to audit)
- Target: <5% misclassification rate

---

### 5. Replay Capability

**Goal:** Deterministic replay for decision-critical steps

#### Requirements

- ⚠️ **Deterministic replay for decision-critical steps:**
  - Status: PARTIAL
  - Uses stored input/output from event log
  - Does not re-call external APIs or LLMs
  - Reconstructs state transitions exactly as recorded in event log

- ❌ **Does not re-call external APIs (results may differ)**
  - Status: NOT IMPLEMENTED
  - Would need to store API responses
  - Currently not stored comprehensively

- ❌ **Reconstructs state transitions exactly as recorded in event log**
  - Status: NOT IMPLEMENTED
  - Event log exists but no replay mechanism
  - Would need replay tooling

**Metric:** 100% success rate on random sample (n=100)

- Current: 0% (no replay capability)
- Target: 100%

**Best-effort replay for non-critical enrichment:**

- ⚠️ **May re-call external APIs (results may differ)**
  - Status: PARTIAL
  - Can re-run agents but results may differ
  - Used for debugging, not compliance

- ❌ **Used for debugging, not compliance**
  - Status: NOT IMPLEMENTED
  - No formal debugging replay process

**Metric:** >90% success rate

- Current: Unknown
- Target: >90%

- ❌ **Replay does not trigger side effects (writes are simulated)**
  - Status: NOT IMPLEMENTED
  - Replay would trigger real writes
  - Need simulation mode

- ⚠️ **Replay time is <10x original processing time**
  - Status: UNKNOWN
  - No replay capability to measure
  - Target: <10x original time

---

### 6. Admin Transparency

**Goal:** Item location answerable in <30 seconds

#### Requirements

- ✅ **Item location answerable in <30 seconds**
  - Status: IMPLEMENTED
  - Admin UI shows current state and location
  - Search by URL, title, or ID

- ✅ **Full timeline visible – current + all prior state**
  - Status: IMPLEMENTED
  - Pipeline timeline shows all steps and state changes
  - Visible in item detail view

- ⚠️ **Blockers are explicit (not inferred)**
  - Status: PARTIAL
  - Error messages shown
  - Not always explicit about what's blocking progress

**Metric:** Mean time to locate item <30s

- Current: ~15s (estimated)
- Target: <30s

---

## Exit Criteria Phase 1 (Auditable)

To graduate from Phase 1, the system must meet these measurable thresholds:

| Criterion                        | Measurement Method                         | Threshold                           |
| -------------------------------- | ------------------------------------------ | ----------------------------------- |
| **State validity**               | Database constraint violations             | 0 invalid states                    |
| **Side-effect idempotency**      | Duplicate side-effect detection            | 0 duplicate side effects in 30 days |
| **Event completeness**           | State change vs. event count               | 1:1 ratio                           |
| **Deterministic replay success** | Random sample replay test (critical steps) | 100% success rate (n=100)           |
| **Best-effort replay success**   | Random sample replay test (non-critical)   | >90% success rate (n=100)           |
| **Admin query speed**            | P95 latency for "where is item X"          | <30 seconds                         |
| **Zero silent failures**         | Error log completeness audit               | 100% of failures logged             |

### Current Status Against Exit Criteria

| Criterion               | Current | Target       | Status |
| ----------------------- | ------- | ------------ | ------ |
| State validity          | ~95%    | 0 invalid    | ❌     |
| Side-effect idempotency | Unknown | 0 duplicates | ❌     |
| Event completeness      | 100%    | 1:1 ratio    | ✅     |
| Deterministic replay    | 0%      | 100%         | ❌     |
| Best-effort replay      | Unknown | >90%         | ❌     |
| Admin query speed       | ~15s    | <30s         | ✅     |
| Zero silent failures    | Unknown | 100%         | ❌     |

**Overall:** 2/7 criteria met (29%)

---

## Current Overall Status

### Summary by Requirement

| Requirement               | Status             | Completion |
| ------------------------- | ------------------ | ---------- |
| 1. Workflow State Machine | ✅ Mostly Complete | 90%        |
| 2. Idempotency            | ⚠️ Partial         | 40%        |
| 3. Event Logging          | ✅ Complete        | 95%        |
| 4. Failure Classification | ⚠️ Partial         | 30%        |
| 5. Replay Capability      | ❌ Not Started     | 10%        |
| 6. Admin Transparency     | ✅ Complete        | 90%        |

### Overall Phase 1 Completion: ~60%

**Strengths:**

- Strong event logging and auditability
- Good admin transparency
- Solid state machine foundation

**Gaps:**

- No replay capability
- Incomplete failure classification
- Limited idempotency guarantees
- No dead-letter queue

---

## Next Steps to Complete Phase 1

### High Priority

1. **Implement Dead-Letter Queue**
   - Add `kb_dead_letter_queue` table
   - Route terminal errors to DLQ
   - Add admin UI for DLQ management

2. **Improve Failure Classification**
   - Classify all error types (retryable vs terminal)
   - Implement exponential backoff with jitter
   - Add special handling for 429 and 5xx errors

3. **Add Idempotency Checks**
   - Detect duplicate API requests
   - Ensure safe retry for all agents
   - Add deduplication at API level

### Medium Priority

4. **Build Replay Capability**
   - Create replay tooling for event log
   - Add simulation mode (no side effects)
   - Test on sample of 100 items

5. **Improve State Machine Validation**
   - Add explicit validation for invalid transitions
   - Return clear error messages
   - Log validation failures

### Low Priority

6. **Enhance Admin Transparency**
   - Make blockers more explicit
   - Add "why is this stuck?" explainer
   - Improve error message clarity

---

## Metrics Dashboard

Track these metrics to measure Phase 1 maturity:

| Metric                         | Current | Target | Status |
| ------------------------------ | ------- | ------ | ------ |
| Valid state at all times       | ~95%    | 100%   | ⚠️     |
| Duplicate side effects (30d)   | Unknown | 0      | ❌     |
| State changes with events      | 100%    | 100%   | ✅     |
| Failure misclassification rate | Unknown | <5%    | ❌     |
| Replay success rate (n=100)    | 0%      | 100%   | ❌     |
| Time to locate item            | ~15s    | <30s   | ✅     |

---

## References

- State Machine: `services/agent-api/src/lib/state-machine.js`
- Pipeline Tracking: `services/agent-api/src/lib/pipeline-tracking.js`
- Event Log: `kb_pipeline_run`, `kb_pipeline_step_run` tables
- Admin UI: `admin-next/src/app/(dashboard)/items/[id]/page.tsx`

---

**Last Updated:** 2026-01-02  
**Next Review:** 2026-02-01
