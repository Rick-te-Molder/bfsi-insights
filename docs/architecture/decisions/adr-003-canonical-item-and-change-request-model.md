# ADR-003: Canonical Item + Change Request Model (Single Authoritative State)

**Status:** Accepted  
**Date:** 2026-01-13  
**Decision Makers:** Architecture team

## Context

BFSI Insights currently represents content lifecycle state across multiple tables, notably:

- `ingestion_queue`: pipeline/workflow state (enrichment steps, retries, intermediate statuses)
- `kb_publication`: published artifact (approved/published content)

In practice, a single logical “item” can appear in both tables simultaneously. This has created ambiguity and operational risk:

- UI and operators can interpret “one item in two statuses” (e.g., published content exists while a queue row is mid-pipeline)
- Re-enrichment of published items can reintroduce intermediate states, making it unclear which row owns the authoritative status
- Duplicate detection semantics become muddled if we repurpose “duplicate” statuses to hide or clean up lifecycle inconsistencies

This resembles well-known enterprise workflows:

- **Lending**: a loan exists in servicing, while a change request/application is created and approved to update the loan.
- **SDLC**: a release exists in production, while a branch/PR represents proposed changes that only become “the release” after approval.

We need a long-lived, fail-safe data model with:

- A single authoritative state per logical item.
- Explicit “change requests” for re-enrichment and approval.
- Full history/auditability.
- Clear semantics for duplicates (only true duplicates), not lifecycle bookkeeping.

## Decision

Adopt a **canonical item + change request** model:

- Introduce a canonical table `kb_item` that represents exactly one logical item and owns the **single authoritative `status_code`**.
- Represent re-enrichment (and initial ingestion) as `kb_item_request` rows (change requests), linked to `kb_item`.
- Keep published content in `kb_publication` as **versioned artifacts** linked to `kb_item`.
- During re-enrichment and review, the item remains visible; only after approval do we create a new publication version and update the canonical item’s “current version” pointer.

### Status ownership

- `kb_item.status_code` is the **only authoritative status** for a logical item.
- `kb_item_request.status_code` represents the request lifecycle (e.g., draft, enriching, pending review, rejected, cancelled, applied).
- UI and APIs must treat request status as a sub-state/details, not as the item’s primary state.

### Visibility semantics (confirmed requirements)

1. During re-enrichment and during review, the item must remain visible in the published view.
2. After approval, the item is updated to the new version.

## Proposed Schema (logical)

### `kb_item` (canonical)

Represents the “loan in servicing / released artifact”.

- `id` (uuid, PK)
- `canonical_url` (text)
- `canonical_url_hash` (text/bytea) for uniqueness and indexing
- `status_code` (int, FK to `status_lookup.code`)
- `current_publication_id` (uuid, FK to `kb_publication.id`, nullable)
- `active_request_id` (uuid, FK to `kb_item_request.id`, nullable)
- `created_at`, `updated_at`

### `kb_item_request` (change request)

Represents “loan modification request / PR branch”.

- `id` (uuid, PK)
- `item_id` (uuid, FK to `kb_item.id`)
- `request_type` (text) e.g. `initial_ingest`, `reenrich`
- `status_code` (int, FK to `status_lookup.code`)
- `proposed_payload` (jsonb) (enrichment results to apply)
- `created_by` (text/user id)
- `created_at`, `updated_at`

### `kb_publication` (versioned artifacts)

Represents “published versions”.

- `id` (uuid, PK)
- `item_id` (uuid, FK to `kb_item.id`)
- `version` (int) or version identity via `published_at`
- `payload` (jsonb) (published snapshot)
- `origin_request_id` (uuid, FK to `kb_item_request.id`, nullable)
- `published_at`

### Optional: `pipeline_run` / `pipeline_step_run`

Keep workflow execution details separate for auditability:

- `pipeline_run` references `kb_item_request.id`
- step-level outputs/errors captured in step run table

## Invariants (Fail-safe rules)

1. **Single authoritative state**
   - The logical item state is always `kb_item.status_code`.

2. **One active request per item (at most)**
   - Enforced by constraint/index (e.g., partial unique index on `(item_id)` where request status is “active”).

3. **Published visibility during change**
   - A `kb_item` with `current_publication_id` remains visible even if `active_request_id` exists.

4. **Approval applies changes atomically**
   - Applying a request must:
     - create a new `kb_publication` version
     - update `kb_item.current_publication_id`
     - clear `kb_item.active_request_id`
     - update `kb_item.status_code` (typically remains “published”)

5. **Duplicates remain true duplicates**
   - “Duplicate” statuses/flags must only be used when two candidates refer to the same canonical item (same canonical key) and one must be discarded.

6. **Status codes are always numeric and sourced from `status_lookup`**
   - All state queries and transitions must use `status_code` (not text status).

## Consequences

### Positive

- Clear ownership of “the item” and its state.
- Re-enrichment becomes a first-class change request with explicit linkage and audit trail.
- Published content remains visible while changes are pending.
- Duplicate detection is no longer polluted by lifecycle cleanup.
- Enables consistent UI: one row per logical item with optional “active request” badge.

### Negative / Costs

- Requires schema changes and backfills.
- Requires migrating UI and API query patterns to treat `kb_item` as authoritative.
- Requires transition logic for request lifecycle (and potentially new status categories in `status_lookup`).

## Alternatives Considered

1. **Keep current model, “fix in UI”**
   - Hide queue rows when a publication exists.
   - Rejected as end-state: does not create a single authoritative source of truth; still fragile.

2. **Single table for everything**
   - Store workflow and published data in one table.
   - Deferred: increases row complexity and update contention; weaker audit/versioning semantics.

3. **Treat `ingestion_queue` as the canonical item**
   - Make publications derived views only.
   - Rejected: publications require stable versioning semantics and are not a workflow log.

## Rollout Plan (Incremental)

1. **Introduce tables and links**
   - Add `kb_item`, `kb_item_request`, and `kb_publication.item_id`.
   - Backfill `kb_item` from existing `kb_publication` and/or canonicalized source URLs.

2. **Adopt canonical read path**
   - Update admin list/detail pages to read from `kb_item` and join in `current_publication_id` and `active_request_id`.

3. **Adopt canonical write path for re-enrichment**
   - Re-enrichment creates a `kb_item_request` linked to the item and drives pipeline runs off the request.

4. **Deprecate ambiguous lifecycle state in `ingestion_queue`**
   - Either migrate it to request/run semantics or restrict it to internal pipeline logs.

## References

- Lending analogy: loan + modification request (single customer-visible state)
- SDLC analogy: release + branch/PR (proposal becomes release after approval)
- `status_lookup` (single source of truth for `status_code`)
- Existing decisions:
  - `docs/architecture/decisions/adr-001-typescript-strategy-agent-api.md`
  - `docs/architecture/decisions/adr-002-datetime-column-naming.md`
