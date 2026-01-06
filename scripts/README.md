# Scripts Directory

Utility scripts for BFSI Insights.

> **Note**: The main agent pipeline has moved to `services/agent-api/`. See the main README.md for agent commands.

## Directory Structure

```
scripts/
├── ci/                 # Deterministic checks used in CI/hooks
├── dev/                # Local developer utilities
├── ops/                # Operational scripts (may touch prod)
├── lib/                # Shared helpers used by scripts/services
└── sql/                # Operational SQL + one-time SQL (see sql/README.md)
```

## Folder Boundaries

| Folder | Mutations     | Deterministic         | Environment                          |
| ------ | ------------- | --------------------- | ------------------------------------ |
| `ci/`  | ❌ No         | ✅ Yes                | Any (must be fast)                   |
| `dev/` | ⚠️ Local only | ❌ May be interactive | Local only                           |
| `ops/` | ✅ Yes        | ❌ May be slow        | Any (prod requires `--confirm-prod`) |

**Rules:**

- **ci/** scripts must be pure (no mutations, deterministic, short runtime)
- **dev/** scripts may be interactive and assume local environment
- **ops/** scripts may mutate data and must have safety headers

## Safety Header Template

All scripts in `ops/` must include a safety header:

```js
#!/usr/bin/env node
/**
 * @script <filename>.mjs
 * @safety SAFE | CAUTIOUS | DANGEROUS
 * @env    local, staging, prod
 *
 * @description
 * Brief description of what the script does.
 *
 * @sideEffects
 * - List of mutations (or "None" if read-only)
 *
 * @rollback
 * Steps to undo the changes (or "N/A" if read-only)
 *
 * @usage
 *   node scripts/ops/<filename>.mjs [options]
 */
```

**Safety levels:**

- `SAFE` - Read-only, no mutations
- `CAUTIOUS` - Makes changes but has dry-run or is reversible
- `DANGEROUS` - Mutates production data, requires care

## Naming Conventions

| Prefix              | Purpose               | Example                         |
| ------------------- | --------------------- | ------------------------------- |
| `check-*`           | Read-only validations | `check-stale-items.mjs`         |
| `fix-*`             | Corrective mutations  | `fix-invalid-payment-codes.mjs` |
| `publish-*`         | Publishing actions    | `publish-approved.mjs`          |
| `dump-*` / `view-*` | Diagnostics           | `dump-schema.mjs`               |

## File Extensions

- `.mjs` - Default for all ESM scripts
- `.cjs` - Only when CJS is required (e.g., shared with CJS-only tooling)

## Publishing

### publish-approved.mjs

Publishes approved items from ingestion_queue to kb_publication.

```bash
node scripts/ops/publish-approved.mjs --limit=10 --dry-run
```

## Utilities

### check-links.mjs

Checks for broken external links in published content.

```bash
npm run check:links
```

### test-rss-feeds.mjs

Validates RSS feeds configured in kb_source.

```bash
node scripts/dev/test-rss-feeds.mjs
```

## Agent Pipeline

The agent pipeline has moved to `services/agent-api/`. Use the CLI:

```bash
# Discovery, Filter, Summarize, Tag, Thumbnail
node services/agent-api/src/cli.js discovery --limit=10
node services/agent-api/src/cli.js enrich --limit=20
```

See main README.md for full documentation.
