# Takedown Procedure

This document describes how to perform content takedowns for legal/compliance reasons.

## Overview

Takedowns permanently delete raw content from storage while preserving metadata for audit purposes. All takedowns are logged to the `takedown_log` table and the content hash is added to the blocklist to prevent re-ingestion.

## API Endpoints

### Takedown by Queue ID

```bash
curl -X DELETE "https://api.bfsiinsights.com/api/raw-content/by-queue/{queueId}" \
  -H "X-API-Key: $AGENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "DMCA takedown request #12345",
    "requestedBy": "legal@company.com"
  }'
```

### Takedown by Content Hash

Use this when you have the SHA-256 hash of the content (affects all queue items with this content):

```bash
curl -X DELETE "https://api.bfsiinsights.com/api/raw-content/by-hash/{contentHash}" \
  -H "X-API-Key: $AGENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Copyright infringement claim",
    "requestedBy": "legal@company.com"
  }'
```

## What Happens During Takedown

1. **Storage Deletion**: Raw content is deleted from `kb-raw` bucket
2. **Thumbnail Deletion**: Associated thumbnail is deleted from `kb-thumb` bucket
3. **Row Updates**: All `ingestion_queue` rows with that `raw_ref` are updated:
   - `storage_deleted_at` = current timestamp
   - `deletion_reason` = "takedown: {reason}"
4. **Blocklist Entry**: Content hash is added to `takedown_blocklist`
5. **Audit Log**: Entry is created in `takedown_log`

## Response Format

### Success

```json
{
  "success": true,
  "rowsAffected": 3
}
```

### Not Found

```json
{
  "error": "Content not found"
}
```

## Audit Trail

All takedowns are logged to the `takedown_log` table:

| Column          | Description                          |
| --------------- | ------------------------------------ |
| `target_type`   | `content_hash`, `url`, or `queue_id` |
| `target_value`  | The actual hash, URL, or queue ID    |
| `raw_ref`       | Storage key that was deleted         |
| `reason`        | Reason provided for takedown         |
| `requested_by`  | Who requested the takedown           |
| `rows_affected` | Number of queue rows updated         |
| `outcome`       | `success`, `not_found`, or `error`   |
| `created_at`    | Timestamp of the takedown            |

## Blocklist

After takedown, the content hash is added to `takedown_blocklist`. This prevents the same content from being re-ingested even if discovered from a different URL.

## Finding Content to Take Down

### By URL

```sql
SELECT id, raw_ref, content_hash, url
FROM ingestion_queue
WHERE url LIKE '%example.com%'
  AND storage_deleted_at IS NULL;
```

### By Content Hash

```sql
SELECT iq.id, iq.url, ro.storage_key
FROM ingestion_queue iq
JOIN raw_object ro ON iq.content_hash = ro.content_hash
WHERE ro.content_hash = 'abc123...';
```

## Emergency Procedures

For urgent takedowns (e.g., court orders):

1. Use the API endpoint immediately
2. Verify deletion in `takedown_log`
3. Document the request in your ticketing system
4. Notify relevant stakeholders

## Verification

After takedown, verify:

```sql
-- Check takedown was logged
SELECT * FROM takedown_log
WHERE target_value = '{hash_or_queue_id}'
ORDER BY created_at DESC
LIMIT 1;

-- Check blocklist entry
SELECT * FROM takedown_blocklist
WHERE content_hash = '{hash}';

-- Check rows were updated
SELECT id, storage_deleted_at, deletion_reason
FROM ingestion_queue
WHERE raw_ref = '{raw_ref}';
```

## Related Documentation

- [ADR-004: Raw Data Storage Strategy](../architecture/decisions/adr-004-raw-data-storage.md)
- [US-8: Takedown Capability](../backlog/raw-data-storage.md)
