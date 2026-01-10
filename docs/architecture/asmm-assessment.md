# ASMM Assessment

This document captures the current ASMM (Agentic Systems Maturity Model) phase assessment across the 12 dimensions for this repository.

**Rule:** Phase readiness is determined by exit criteria. Ratings below reflect current evidence in the codebase and operational artifacts.

---

## Summary

**Phase 0 dimensions (must reach Phase 1 next):**

- **7. Spend + Capacity Controls**: Phase 0
- **9. Privacy + Prompt Ops**: Phase 0

All other dimensions are assessed at **Phase 1** or higher.

---

## Dimension Ratings

| #   | Dimension                   | Phase | Rationale (evidence-based)                                                                                                                        |
| --- | --------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Knowledge Store + Indexing  | 1     | Structured storage/indexing exists; quality/controls not fully enforced as a governed system.                                                     |
| 2   | Durable Workflow Engine     | 1     | Pipeline run/step tracking exists; retries/DLQ and replay capabilities exist; Phase 2 controls not fully standardized across all execution paths. |
| 3   | Source Adapters + Ingestion | 1     | Ingestion sources exist and are operational; per-source health/lag and deterministic re-ingest proofs are not fully evidenced.                    |
| 4   | Tool Execution Plane        | 1     | Tools are invoked through code paths with logging; policy-checked registry and standardized execution contracts are not fully enforced.           |
| 5   | Policy Guardrails           | 1     | Some governance/audit structures exist; policy-as-code and centralized decision logs are not uniformly implemented.                               |
| 6   | Telemetry + Control         | 1     | Tracing and structured logging exist (e.g., LangSmith optional tracing); Phase 2 dashboards/alerts and run-level SLOs not yet proven.             |
| 7   | Spend + Capacity Controls   | 0     | Cost attribution per run was missing; tokens/cost persisted per run is required to move to Phase 1.                                               |
| 8   | Traceability (Lineage)      | 1     | Pipeline status history and audit primitives exist; end-to-end lineage/evidence packages not fully formalized.                                    |
| 9   | Privacy + Prompt Ops        | 0     | Prompt governance/versioning and privacy controls are not consistently enforced and evidenced; needs systematic prompt ops.                       |
| 10  | Retrieval Quality System    | 1     | Retrieval scoring and quality logic exists (e.g. scorer); systematic evals/drift controls not yet evidenced.                                      |
| 11  | Session Records             | 1     | Replay capability and run logs exist; durable session record policies/exports not yet fully evidenced.                                            |
| 12  | Run APIs + Evidence Export  | 1     | Run status and pipeline tracking exists; evidence export packages and immutable provenance not yet established.                                   |

---

## Notes

- This assessment is intended to drive near-term work via Phase 0 → Phase 1 user stories.
- When evidence changes (e.g., cost tracking landed, prompt versioning is enforced), update this document alongside the implementation.
