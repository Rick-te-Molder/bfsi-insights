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
