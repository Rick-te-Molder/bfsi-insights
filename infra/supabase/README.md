# Supabase (source of truth)

This folder is the **source of truth** for database infrastructure:

- `migrations/` — schema changes and state transitions
- `functions/` — Supabase edge functions
- `policies/` (if present) — RLS policies / auth rules
- `seed.sql` — local/dev seed data (when applicable)

Operational SQL that is run manually (one-time fixes, recurring checks, backfills) intentionally lives in:

- `scripts/sql/*`

Use `scripts/run-sql.mjs` for safe execution (dry-run by default, explicit prod confirmation).
