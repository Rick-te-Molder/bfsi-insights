# Agentic Systems Maturity Model (ASMM)

## Architecture Guide for Reaching the Next Phase

This document operationalizes the Agentic Systems Maturity Model (ASMM) for engineers and synthetic coders.

Its purpose is not to restate the model, but to help answer one concrete question:

“Given our current phase, what are the next concrete technical steps required to reach the next phase?”

Phase readiness is determined only by exit criteria.
Examples and patterns are illustrative, not normative.

---

## How to Use This Document

1. Identify your current phase (1–5) using the ASMM exit criteria.
2. For each of the 12 dimensions, check:

- What must newly exist in the next phase
- What evidence must be produced

3. Implement only what is required to cross the phase boundary.
4. Do not pre-optimize for later phases.

Rule of thumb:
If a change does not move at least one exit criterion from “failing” to “passing”, it is premature.

---

## Phase Overview (Reminder)

| Phase | Name                | Core Question                                     |
| ----- | ------------------- | ------------------------------------------------- |
| 0     | Ad-hoc              | Does the system exist at all?                     |
| 1     | Foundation          | Does the system behave predictably?               |
| 2     | Controlled          | Can we observe, steer, and intervene?             |
| 3     | Reliable Quality    | Is quality measurable and protected?              |
| 4     | Product + Trust     | Can users rely on it and can we defend it?        |
| 5     | Scale + Institution | Can it scale sustainably without loss of control? |

---

## Dimension-by-Dimension Guidance

Each section below answers:

- What changes between phases
- What to implement next
- What evidence must exist

---

## Phase 0 → Phase 1 Enablement (Per Dimension)

### Definition

- **Phase 0** = ad-hoc, best-effort, demo-grade behavior
- **Phase 1** = deterministic, observable, failure-safe behavior

A system may be Phase 1 in some dimensions and Phase 0.x in others.

> **Rule:** Phase 1 is reached per dimension, not per system.

This section defines the minimum engineering required to enter Phase 1.

### How Synthetic Coders Should Use This Section

For each dimension:

1. Ask: Can we prove the Phase 1 exit criterion today?
2. If no, assume the dimension is Phase 0.x
3. Implement only the items listed below
4. Produce the evidence
5. Re-evaluate Phase 1 exit criteria

---

## 1. Knowledge Store + Indexing

### Phase 0 → 1

**Phase 0 symptoms**

- IDs generated inconsistently
- Records mutable or overwritten
- No single source of truth

**Implement**

- Canonical entity definitions
- Immutable internal IDs assigned at ingest
- One authoritative store per entity type

**Evidence**

- DB query shows 100% items with canonical ID
- No updates mutate identity fields

---

### Phase 1 → 2 (What to Add)

**Goal:** Make indexing observable and repeatable

**Implement**

- Deterministic reindex jobs (same input → same index state)
- Index lag tracking per source

**Evidence**

- DB queries showing index freshness
- Reindex diff audits (n≈30)

---

### Phase 2 → 3

**Goal:** Make quality structurally enforceable

**Implement**

- Explicit schemas per content type
- Schema validation before publish

**Evidence**

- Zero schema violations in published outputs
- Schema registry audit

---

### Phase 3 → 4

**Goal:** Make references externally defensible

**Implement**

- Stable external identifiers
- Link integrity checks

**Evidence**

- 0 broken references over 30 days
- ID stability audit

---

### Phase 4 → 5

**Goal:** Make indexing multi-tenant and scalable

**Implement**

- Tenant-aware partitions
- Cost-aware indexing strategies

**Evidence**

- No cross-tenant reads
- <10% P95 degradation at 10× volume

---

## 2. Durable Workflow Engine

### Phase 0 → 1

**Phase 0 symptoms**

- Implicit steps
- Manual retries
- Hidden failures

**Implement**

- Explicit workflow states
- Entry/exit conditions per state
- Idempotent step execution

**Evidence**

- DB constraints prevent invalid states
- Retry produces no duplicates

---

### Phase 1 → 2

**Goal:** Make execution observable and recoverable

**Implement**

- Run / step / attempt model
- Retry + DLQ with visibility

**Evidence**

- Event logs show retries and outcomes
- ≥95% auto-recovery

---

### Phase 2 → 3

**Goal:** Prevent quality bypass

**Implement**

- Quality gates embedded in workflow
- Explicit rollback semantics

**Evidence**

- 0 bypassed gates without override record

---

### Phase 3 → 4

**Goal:** Enforce authorization on decisions

**Implement**

- Role-based authorization for state transitions

**Evidence**

- 0 unauthorized transitions to “publish/decision”

---

### Phase 4 → 5

**Goal:** Scale throughput predictably

**Implement**

- Capacity-aware scheduling
- Backpressure handling

**Evidence**

- <10% latency increase at 10× load

---

## 3. Source Adapters + Ingestion

### Phase 0 → 1

**Phase 0 symptoms**

- Manual imports
- Silent ingestion failures
- No outcome visibility

**Implement**

- Explicit ingest attempt logging
- Success / failure recording with reason

**Evidence**

- 100% ingest attempts have recorded outcome

---

### Phase 1 → 2

**Goal:** Make ingestion observable per source

**Implement**

- Cursoring (ETag / Last-Modified)
- Health metrics per connector

**Evidence**

- Connector success rate & latency metrics

---

### Phase 2 → 3

**Goal:** Make ingestion structurally correct

**Implement**

- Normalize → redact → chunk → embed pipeline
- Schema validation on ingest

**Evidence**

- ≥99% ingests schema-valid
- ≤1% partial/inconsistent retries

---

### Phase 3 → 4

**Goal:** Make connectors governable

**Implement**

- Approval workflow for connectors
- Owner + scope registry

**Evidence**

- 100% connectors approved and documented

---

### Phase 4 → 5

**Goal:** Scale source onboarding safely

**Implement**

- Connector extension framework
- Standard failure contracts

**Evidence**

- New source live ≤30 days
- ≤2% failure rate at scale

---

## 4. Tool Execution Plane

### Phase 0 → 1

**Phase 0 symptoms**

- Direct API calls
- Side effects not tracked
- Inputs/outputs lost

**Implement**

- Wrapper around every tool call
- Log inputs + outputs per execution

**Evidence**

- Structured logs show 100% tool executions

---

### Phase 1 → 2

**Goal:** Make side effects observable

**Implement**

- Standard wrappers around all tool calls
- Structured logs with input/output references

**Evidence**

- 100% executions logged
- 0 unauthorized executions

---

### Phase 2 → 3

**Goal:** Make tool behavior deterministic

**Implement**

- Typed error codes
- Mandatory wrapper enforcement

**Evidence**

- ≥99% deterministic success/failure
- No direct (unwrapped) calls

---

### Phase 3 → 4

**Goal:** Make execution policy-checked

**Implement**

- Tool registry (schema, version, permissions)
- Policy-checked execution

**Evidence**

- 0 ad-hoc tool calls

---

### Phase 4 → 5

**Goal:** Isolate execution per tenant

**Implement**

- Tenant-isolated runtimes
- Quotas per tenant

**Evidence**

- 0 cross-tenant leakage
- ≥99% success at scale

---

## 5. Policy Guardrails

### Phase 0 → 1

**Phase 0 symptoms**

- Rules embedded in code
- Violations discovered after the fact

**Implement**

- Central policy checks
- Hard block on violation

**Evidence**

- 100% blocked executions logged with rule ID

---

### Phase 1 → 2

**Implement**

- Central policy decision logging

### Phase 2 → 3

**Implement**

- Quality policies as code

### Phase 3 → 4

**Implement**

- Policy-as-code with change management

### Phase 4 → 5

**Implement**

- Continuous controls monitoring

**Evidence (all phases):** policy logs + audits

---

## 6. Telemetry + Control

### Phase 0 → 1

**Phase 0 symptoms**

- "It failed" without explanation
- Missing transitions

**Implement**

- Event log for all state transitions
- Error logging with codes

**Evidence**

- No silent failures in 30-day audit

---

**Progression**

- Phase 1: events exist
- Phase 2: dashboards + alerts
- Phase 3: quality signals
- Phase 4: SLOs + incidents
- Phase 5: automated mitigation

Synthetic coders should treat telemetry gaps as blocking defects, not enhancements.

---

## 7. Spend + Capacity Controls

### Phase 0 → 1

**Phase 0 symptoms**

- Unknown cost
- Unbounded runs

**Implement**

- Cost estimation per run
- Basic runtime / call caps

**Evidence**

- ≥90% runs have estimated cost recorded

---

**Progression**

- Rough awareness → per-run cost → budgets → tenant showback → predictive optimization

Key rule:

If you cannot attribute cost to runs, you cannot scale.

---

## 8. Traceability (Lineage)

### Phase 0 → 1

**Phase 0 symptoms**

- Outputs disconnected from sources
- Manual reconstruction

**Implement**

- Store source references per output

**Evidence**

- 100% outputs link to ≥1 source

---

**Progression**

- Source links → transform lineage → explainability → impact analysis

Rule:

If you cannot answer "why did this output exist?", you are pre-Phase-4.

---

## 9. Privacy + Prompt Ops

### Phase 0 → 1

**Phase 0 symptoms**

- Raw data passed to prompts
- PII in logs

**Implement**

- Default redaction
- Log scanning for sensitive data

**Evidence**

- 0 detected sensitive data in sampled logs

---

**Progression**

- Avoid PII → detect PII → version prompts → retention rules → tenant privacy isolation

Synthetic coders must never embed secrets or raw PII in prompts by default.

---

## 10. Retrieval Quality System

### Phase 0 → 1

**Phase 0 symptoms**

- Empty or random results
- No ranking logic

**Implement**

- Basic lexical or semantic retrieval
- Visibility into empty results

**Evidence**

- ≥95% retrieval calls return ≥1 result

---

**Progression**

- Non-empty results → deterministic ranking → evaluation → audience relevance → drift correction

Rule:

Retrieval quality is a first-class system, not a model parameter.

---

## 11. Session Records

### Phase 0 → 1

**Phase 0 symptoms**

- Stateless execution
- Lost context

**Implement**

- Session/run identifiers
- Persisted context per run

**Evidence**

- 100% runs reconstructable from session data

---

**Progression**

- Minimal history → durable sessions → searchable → governed analytics → multi-tenant export

If sessions cannot be reconstructed, audits and support will fail.

---

## 12. Run APIs + Evidence Export

### Phase 0 → 1

**Phase 0 symptoms**

- No status visibility
- Manual debugging

**Implement**

- Run status endpoint
- Timeline per run

**Evidence**

- P95 admin query time ≤30s

---

**Progression**

- Status endpoint → timelines → evidence packages → immutable hashes → bulk exports

Rule:

If auditors need engineers to prepare evidence, you are not Phase-4 ready.

---

## Key Principle for Synthetic Coders

**Phase 1 is not "feature completeness". Phase 1 is operational determinism.**

If a dimension:

- cannot be replayed,
- cannot be explained,
- or cannot be audited,

…it is not yet Phase 1, regardless of how advanced it looks.

---

## Common Anti-Patterns (Avoid)

- Implementing Phase-4 controls before Phase-2 observability
- Adding dashboards without deterministic workflows
- Scaling ingestion without schema enforcement
- Treating examples as requirements
- Optimizing models before retrieval quality is measured

---

## Final Guidance for Synthetic Coders

When asked “what should I implement next?”:

1. Identify the lowest failing exit criterion
2. Implement the minimum change that makes it pass
3. Produce verifiable evidence
4. Stop

ASMM rewards discipline, not ambition.

---

## Source

Agentic Systems Maturity Model (ASMM), v0.8 Master Deck ￼
