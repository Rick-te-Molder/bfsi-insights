# SQL scripts

This folder contains **operational SQL** and **one-time SQL** that is intentionally kept out of `infra/supabase/migrations/`.

## Categories

| Folder      | Mutations    | Purpose                                   |
| ----------- | ------------ | ----------------------------------------- |
| `ops/`      | ❌ Read-only | Recurring checks, diagnostics, validation |
| `one-time/` | ✅ Allowed   | Scripts executed once, kept for audit     |

**Hard rules:**

- `ops/` must be **read-only** (`SELECT`, `EXPLAIN`, `WITH ... SELECT`)
- `one-time/` may contain `INSERT`, `UPDATE`, `DELETE`, or DDL
- If a mutation script needs to run regularly, it belongs in `one-time/` with clear naming and must include rollback steps

## How to run safely

Use the wrapper:

```bash
node scripts/run-sql.mjs --env=<local|staging|prod> --file <path-to-sql>
```

Defaults:

- `DRY_RUN=1` is the default.
- You must set `DRY_RUN=0` to execute.

The runner requires a database URL via environment variables:

- `DATABASE_URL` (preferred)
- or `SUPABASE_DB_URL`

## Naming conventions

For new one-time scripts:

- `YYYY-MM-DD__purpose__ticket.sql`

Include a header comment in the SQL file describing:

- intent
- expected affected rows
- rollback steps

Existing scripts that do not follow this convention are allowed temporarily and should be renamed when touched.
