# Pipeline Status Codes

This document defines the granular status numbering system for the ingestion pipeline.

## Overview

The pipeline uses a layered numeric status system where:

- **100s** = Discovery stages
- **200s** = Enrichment stages
- **300s** = Review stages
- **400s** = Published states
- **500s** = Terminal/Error states

Each processing step has three states:

- `X0` = Ready/waiting (e.g., `210 = to_summarize`)
- `X1` = In progress (e.g., `211 = summarizing`)
- `X2` = Complete (e.g., `212 = summarized`)

## Benefits

1. **Reorder pipeline** - Can run tagging before summarization
2. **Parallel processing** - Items at different `to_*` states can run simultaneously
3. **Resume from failure** - If `211 summarizing` fails, retry from `210 to_summarize`
4. **Metrics** - Measure duration of each step
5. **Bottleneck detection** - See where items pile up
6. **History tracking** - Know exactly what changed and when

## Status Codes

### 100s - Discovery

| Code | Name         | Description                       |
| ---- | ------------ | --------------------------------- |
| 100  | `discovered` | URL found in RSS/sitemap          |
| 110  | `to_fetch`   | Ready to fetch content            |
| 111  | `fetching`   | Fetch in progress                 |
| 112  | `fetched`    | Content retrieved                 |
| 120  | `to_score`   | Ready for relevance scoring       |
| 121  | `scoring`    | LLM/embedding scoring in progress |
| 122  | `scored`     | Score assigned, ready to route    |

### 200s - Enrichment

| Code | Name                 | Description                   |
| ---- | -------------------- | ----------------------------- |
| 200  | `pending_enrichment` | In queue, awaiting first step |
| 210  | `to_summarize`       | Ready for summary generation  |
| 211  | `summarizing`        | Summary agent working         |
| 212  | `summarized`         | Summary complete              |
| 220  | `to_tag`             | Ready for tagging             |
| 221  | `tagging`            | Tag agent working             |
| 222  | `tagged`             | Tags extracted                |
| 230  | `to_thumbnail`       | Ready for thumbnail           |
| 231  | `thumbnailing`       | Thumbnail agent working       |
| 232  | `thumbnailed`        | Thumbnail generated           |
| 240  | `enriched`           | All enrichment complete       |

### 300s - Review

| Code | Name             | Description                |
| ---- | ---------------- | -------------------------- |
| 300  | `pending_review` | Awaiting curator           |
| 310  | `in_review`      | Curator opened item        |
| 320  | `editing`        | Curator making changes     |
| 330  | `approved`       | Approved, ready to publish |

### 400s - Published

| Code | Name        | Description                           |
| ---- | ----------- | ------------------------------------- |
| 400  | `published` | Live on site                          |
| 410  | `updated`   | Republished after edit (with history) |

### 500s - Terminal/Error

| Code | Name          | Description                 |
| ---- | ------------- | --------------------------- |
| 500  | `failed`      | Technical error (retryable) |
| 510  | `unreachable` | URL 404/timeout             |
| 520  | `duplicate`   | Duplicate URL/content       |
| 530  | `irrelevant`  | Auto-filtered by scoring    |
| 540  | `rejected`    | Human rejected              |

## State Transitions

```
Discovery Flow (auto-discovered):
100 → 110 → 111 → 112 → 120 → 121 → 122 → 200
                                      ↓
                                     530 (irrelevant)

Manual Entry Flow (skips scoring - human already decided it's relevant):
  URL only:      manual → 110 → 111 → 112 → 200 (skip 120-122)
  With content:  manual → 200 (skip fetch + scoring)
  With summary:  manual → 220 (skip fetch + scoring + summarize)
  Complete:      manual → 300 (review only)

Enrichment Flow (configurable order):
200 → 210 → 211 → 212 → 220 → 221 → 222 → 230 → 231 → 232 → 240 → 300

Review Flow:
300 → 310 → 320 → 330 → 400
        ↓
       540 (rejected)

Update Flow:
400 → 320 (editing) → 410 (updated)
```

## Entry Types

The `entry_type` column tracks how an item entered the pipeline:

| Value        | Description                                |
| ------------ | ------------------------------------------ |
| `discovered` | Auto-discovered via RSS/sitemap (default)  |
| `manual`     | Added manually by a user                   |
| `import`     | Bulk imported from external source         |
| `retry`      | Re-queued after previous failure/rejection |

Manual items skip relevance scoring (120-122) since a human already decided they're relevant.

## Edit History Tracking

When a published item (400) is edited, field-level changes are tracked:

```sql
-- Call this when saving edits to a publication
SELECT track_publication_edit(
  'publication-uuid',
  'queue-uuid',
  '{"title": "Old Title", "summary": "Old summary"}'::jsonb,  -- old data
  '{"title": "New Title", "summary": "Old summary"}'::jsonb,  -- new data
  'user:rick'
);

-- Query edit history for a publication
SELECT * FROM publication_edit_history
WHERE publication_id = 'publication-uuid'
ORDER BY changed_at DESC;
```

The `field_changes` column shows exactly what changed:

```json
{
  "title": { "old": "Old Title", "new": "New Title" }
}
```

## Database Schema

### status_lookup table

```sql
CREATE TABLE status_lookup (
  code smallint PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text,
  category text NOT NULL,  -- 'discovery', 'enrichment', 'review', 'published', 'terminal'
  is_terminal boolean DEFAULT false,
  sort_order smallint
);
```

### status_history table

```sql
CREATE TABLE status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid REFERENCES ingestion_queue(id) ON DELETE CASCADE,
  from_status smallint REFERENCES status_lookup(code),
  to_status smallint REFERENCES status_lookup(code),
  changed_at timestamptz DEFAULT now(),
  changed_by text,  -- 'agent:summarize', 'user:rick', 'system:auto'
  changes jsonb,    -- {"summary": {"old": "...", "new": "..."}}
  duration_ms int   -- time spent in previous status
);

CREATE INDEX idx_status_history_queue ON status_history(queue_id);
CREATE INDEX idx_status_history_time ON status_history(changed_at);
```

### Migration of existing status column

```sql
-- Add new column
ALTER TABLE ingestion_queue ADD COLUMN status_code smallint;

-- Migrate existing values
UPDATE ingestion_queue SET status_code = CASE status
  WHEN 'pending' THEN 200
  WHEN 'queued' THEN 200
  WHEN 'processing' THEN 211
  WHEN 'enriched' THEN 300
  WHEN 'approved' THEN 330
  WHEN 'rejected' THEN 540
  WHEN 'failed' THEN 500
  ELSE 200
END;

-- Eventually: drop old column, rename new
```

## Usage Examples

### Query items by category

```sql
-- All items in enrichment
SELECT * FROM ingestion_queue WHERE status_code BETWEEN 200 AND 299;

-- All terminal states
SELECT * FROM ingestion_queue WHERE status_code >= 500;

-- Ready for any processing step
SELECT * FROM ingestion_queue WHERE status_code % 10 = 0 AND status_code < 500;
```

### Track time in each state

```sql
SELECT
  sl.name,
  AVG(sh.duration_ms) as avg_duration_ms,
  COUNT(*) as transitions
FROM status_history sh
JOIN status_lookup sl ON sl.code = sh.from_status
GROUP BY sl.name
ORDER BY avg_duration_ms DESC;
```

## Agent Updates Required

| Agent         | Current      | New Flow               |
| ------------- | ------------ | ---------------------- |
| discover      | -            | 100 → 122              |
| enrich (main) | `processing` | Orchestrates 200 → 240 |
| summarize     | -            | 210 → 212              |
| tag           | -            | 220 → 222              |
| thumbnail     | -            | 230 → 232              |
| review UI     | -            | 300 → 330              |
| publish       | -            | 330 → 400              |
