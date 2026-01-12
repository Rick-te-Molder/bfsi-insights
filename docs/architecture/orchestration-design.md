# Orchestration Design

This document describes how orchestration responsibilities are split between:

- `apps/admin/src/app/api/*/route.ts` (Admin API routes)
- `services/agent-api/src/agents/orchestrator.js` (Agent API orchestrator)

The key idea is that there are two layers of orchestration:

- **Control-plane orchestration (Admin)**: prepares an action to be safely executable (IDs, DB invariants, pipeline bookkeeping).
- **Data-plane orchestration (Agent API)**: executes enrichment steps and persists results into the queue payload.

## Responsibilities

## Admin API routes (`route.ts`) — control plane

These endpoints receive user intent from the admin UI (manual actions) and are responsible for making that intent executable and safe.

Responsibilities:

- **Intent handling**
  - Interpret UI intent (e.g., rerun a single step, rerun an item).

- **ID resolution and recovery**
  - Resolve identifiers to `ingestion_queue.id`.
  - When a UI action targets a published item (e.g. by `kb_publication.id`), resolve via `origin_queue_id`.
  - If the original queue item was archived/removed, recreate or reuse a minimal queue row as needed.

- **Workflow invariants / DB state-machine compliance**
  - Ensure any DB updates respect the queue state machine.
  - Avoid forcing invalid `status_code` transitions (e.g. trying to move a review item back into an enrichment step status).

- **Pipeline bookkeeping**
  - Cancel any running `pipeline_run` for the queue item.
  - Create a new `pipeline_run` (e.g. trigger `re-enrich`).
  - Set `ingestion_queue.current_run_id` for traceability.
  - Update payload flags used for execution (e.g. `_single_step`, `_return_status`).

- **Execution invocation**
  - Call the Agent API with a resolved `ingestion_queue.id`.

In short: Admin routes prepare the world so execution can happen safely.

## Agent API orchestrator (`orchestrator.js`) — data plane

The Agent API is responsible for performing enrichment work once it has a valid `ingestion_queue.id`.

Responsibilities:

- **Queue fetch**
  - Fetch the `ingestion_queue` row by id.

- **Execution**
  - Execute enrichment for a full item or a single requested step.

- **Persistence**
  - Merge step outputs into the queue payload.
  - Persist updated payload state.

In short: the orchestrator runs the jobs and persists results; it should not encode admin workflow policy.

## Why the fix lives in Admin (`route.ts`) and not in `orchestrator.js`

If the system fails with a DB-level constraint or state-machine error (e.g. invalid `status_code` transition), the failure typically occurs during Admin-side preparation.

Example:

- A single-step rerun requested from the UI for an item in a review state should not attempt to move the item into an enrichment-step `status_code`.
- The DB state-machine blocks transitions like `400 -> 230`.
- Since this happens before (or while) the agent call is being prepared, the correct fix is to adjust the Admin route logic that performs the update.

Rule of thumb:

- **DB rejected a queue update**: fix the code doing that update (usually Admin routes).
- **Agent execution or payload merging is wrong**: fix the Agent orchestrator.

## Example flow: single-step rerun for a published/review item

1. **Admin API route** (control plane)
   - Resolve `kb_publication.id` to an executable `ingestion_queue.id`.
   - Ensure the queue row exists (recreate/reuse if necessary).
   - Manage pipeline bookkeeping (`pipeline_run`, `current_run_id`).
   - Update payload flags (`_single_step`, `_return_status`).
   - Avoid invalid lifecycle transitions by keeping `status_code` unchanged when appropriate.
   - Call Agent API single-step endpoint.

2. **Agent API orchestrator** (data plane)
   - Fetch the queue item.
   - Execute the requested step.
   - Merge results into payload and persist.

## Notes

- `status_code` is the canonical lifecycle state and is governed by the DB state machine.
- Manual rerun actions should be side-effect-minimal and should not force lifecycle transitions just to run a step.
