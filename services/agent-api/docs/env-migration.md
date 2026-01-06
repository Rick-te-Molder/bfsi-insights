# Agent API env var migration (Supabase)

## Goal

Standardize server-side configuration on canonical env var names (e.g. `SUPABASE_URL`) and stop reading legacy `PUBLIC_*` env vars directly in Agent API code.

This is a multi-phase migration.

## Canonical (server) env vars

- `SUPABASE_URL`
  - Supabase project URL.
- `SUPABASE_SERVICE_KEY`
  - Service role key (server-only).

Optional / only if actually needed server-side:

- `SUPABASE_ANON_KEY`

## Legacy env vars (deprecated)

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`

These exist due to historical coupling with client-side naming conventions.

## Rules

- New code in `services/agent-api/src/**` MUST NOT read any `process.env.PUBLIC_SUPABASE_*` directly.
- Env access should be centralized behind a single module (to be introduced in Phase 1), which will temporarily support fallback:
  - `SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.PUBLIC_SUPABASE_URL`
- A temporary compatibility shim exists to support deployments that still set legacy names.
  - The shim must remain until the final cleanup phase.

## Migration phases (high-level)

- Phase 0: Document + inventory only.
- Phase 1: Introduce an env module + add a guard to prevent new direct legacy reads.
- Phase 2: Centralize Supabase client creation behind a factory.
- Phase 3+: Mechanical replacement in small batches.
- Final: Remove legacy references from codebase, then remove shim.
