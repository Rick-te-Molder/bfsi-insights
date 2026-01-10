# ASMM Phase 0 User Stories (Phase 0 → Phase 1 Enablement)

This document defines the user stories required to move Phase 0 dimensions to Phase 1.

Phase 1 is **Foundation**: predictable behavior, minimal instrumentation, and repeatable operations.

---

## Dimension 7: Spend + Capacity Controls (Phase 0 → Phase 1)

### User Story 7.1 — Persist LLM Cost per Pipeline Run

**As a** platform engineer
**I want** each pipeline run to persist token usage and an estimated USD cost
**So that** spend can be attributed and tracked per run and we can reason about capacity.

#### Acceptance Criteria

- `pipeline_run` contains persisted counters for:
  - `llm_tokens_input`
  - `llm_tokens_output`
  - `embedding_tokens`
  - `estimated_cost_usd`
- Token usage is aggregated to the **correct run** (via run ID propagation).
- Cost is calculated and stored **at run completion**.
- Queries can retrieve cost and token usage per run.

#### Evidence

- Migration and schema docs show the new columns.
- At least one end-to-end run demonstrates non-zero token counts and a computed cost.
- A query example exists:
  - “Top N most expensive runs in last 7 days”

#### Implementation Notes

- Prefer DB-level atomic updates (RPC) for incrementing counters.
- Avoid hardcoded status codes; use `status_lookup` where applicable.

---

### User Story 7.2 — Basic Cost Observability

**As a** platform engineer
**I want** basic logs and queries for cost anomalies
**So that** we can detect runaway costs early.

#### Acceptance Criteria

- A lightweight query exists to show:
  - total spend per day (estimated)
  - spend per agent
  - spend per model
- Errors in cost tracking do not break enrichment execution (fail-open with warnings).

#### Evidence

- Example output of the queries in a runbook or internal doc.

---

## Dimension 9: Privacy + Prompt Ops (Phase 0 → Phase 1)

### User Story 9.1 — Prompt Versioning + Traceability

**As a** platform engineer
**I want** all agent prompts to be versioned and referenced by ID in run records
**So that** agent outputs are reproducible and auditable.

#### Acceptance Criteria

- Prompt versions are stored in a durable store (DB) and referenced by ID.
- Each pipeline step run captures which prompt version was used.
- It is possible to replay a run using the same prompt versions.

#### Evidence

- A sample run record shows prompt version IDs used.
- Replay produces the same prompt text inputs.

---

### User Story 9.2 — Sensitive Data Handling in Prompts

**As a** security/privacy owner
**I want** guardrails that prevent accidental inclusion of secrets/PII in prompts by default
**So that** we reduce privacy and compliance risk.

#### Acceptance Criteria

- Prompt construction paths have a clear policy about what content can be included.
- Secrets (API keys) are never embedded into prompts.
- If PII detection/redaction is not implemented yet, the system has:
  - clear documentation
  - a known backlog item
  - explicit logging to show when raw content is sent to an LLM

#### Evidence

- A documented policy section for prompt inputs.
- Logs show sanitization decisions or explicit non-sanitized cases.
