# ADR-002: Date/Time Column Naming Convention

**Status:** Accepted  
**Date:** 2026-01-12  
**Decision Makers:** Architecture team

## Context

The BFSI Insights database currently uses inconsistent naming for date/time columns across tables and views.

Examples:

- `kb_publication.date_published` vs staging/payload usage of `published_at`
- `kb_publication.date_added` vs widespread use of `created_at`
- `kb_publication.last_edited` vs common `*_at` timestamp naming
- `ingestion_queue.last_modified` (and derived views) uses a timestamp column name that does not end with `_at`

These inconsistencies increase cognitive load, cause UI integration bugs, and make it harder to build generic tooling.

## Decision

### Naming Convention

- Use `*_at` for timestamp columns (`timestamptz` / `timestamp`).
- Use `*_on` for date-only columns (`date`).
- Prefer `created_at` and `updated_at` for generic creation/update timestamps.
- Avoid `date_*` prefixes for timestamp columns.

### Adopted Renames

#### Publications

- `public.kb_publication.date_published` -> `public.kb_publication.published_at`
- `public.kb_publication.date_added` -> `public.kb_publication.added_at`
- `public.kb_publication.last_edited` -> `public.kb_publication.last_edited_at`

The `kb_publication_pretty` view will be updated to expose the new canonical column names.

#### Ingestion queue (and derived tables/views)

- `public.ingestion_queue.last_modified` -> `public.ingestion_queue.last_modified_at`
- `public.ingestion_queue_archive.last_modified` -> `public.ingestion_queue_archive.last_modified_at`

For derived views such as `review_queue_ready` and `retry_queue_ready`, the view definitions will be updated to use `last_modified_at`.

## Consequences

### Positive

- Consistent naming across DB, payloads, and application code.
- Reduced risk of bugs caused by mismatched field names (e.g. `date_published` vs `published_at`).
- Easier to build generic reporting, filtering, and tooling based on naming conventions.

### Negative / Costs

- Requires coordinated schema changes and application updates.
- Requires careful updating of views/functions and client code that references old column names.

## Rollout Plan

1. Add a Supabase migration to rename columns and update dependent views and indexes.
2. Update application code (`apps/admin`, `apps/web`, shared `packages/types`) to use new names.
3. Validate by running admin lint and verifying publication pages and approval flow.

## Alternatives Considered

- Keep legacy names and only map in application code.
  - Rejected: perpetuates inconsistency and continues to create integration bugs.
- Add duplicate columns (new names) and backfill/sync triggers for long-lived compatibility.
  - Deferred: can be added later if external clients require a long deprecation window.
