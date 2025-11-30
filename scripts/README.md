# Scripts Directory

Utility scripts for BFSI Insights.

> **Note**: The main agent pipeline has moved to `services/agent-api/`. See the main README.md for agent commands.

## Directory Structure

```
scripts/
├── publishing/         # Publishing utilities
│   └── publish-approved.mjs
├── utilities/          # Maintenance utilities
│   ├── check-links.mjs     # Check for broken links
│   ├── test-rss-feeds.mjs  # Validate RSS feeds
│   ├── extract-pdf.py      # PDF text extraction
│   └── filename-helper.mjs # Slug/filename utilities
└── _archive/           # Retired scripts (not used)
```

## Publishing

### publish-approved.mjs

Publishes approved items from ingestion_queue to kb_publication.

```bash
node scripts/publishing/publish-approved.mjs --limit=10 --dry-run
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
node scripts/utilities/test-rss-feeds.mjs
```

## Agent Pipeline

The agent pipeline has moved to `services/agent-api/`. Use the CLI:

```bash
# Discovery, Filter, Summarize, Tag, Thumbnail
node services/agent-api/src/cli.js discovery --limit=10
node services/agent-api/src/cli.js enrich --limit=20
```

See main README.md for full documentation.
