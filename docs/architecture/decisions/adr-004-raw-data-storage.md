# ADR-004: Raw Data Storage Strategy

**Status:** Proposed  
**Date:** 2026-01-25  
**Decision Makers:** Architecture team

## Context

BFSI Insights currently does **not** store the original fetched content (PDF bytes, raw HTML) after processing. This creates significant operational and cost challenges:

1. **Re-processing requires re-fetching**: When we upgrade the summarizer, tagger, or enricher, we must re-fetch every publication from its source URL across the entire (ever-growing) database.

2. **Source volatility**: Original URLs may become:
   - Unavailable (404, domain gone)
   - Paywalled (403, subscription required)
   - Changed (different content than originally processed)
   - Blocked (anti-bot measures, rate limiting)

3. **Loss of reproducibility**: Without the original bytes, we cannot explain why a summary changed or reproduce previous processing results.

4. **Operational cost**: Re-fetching at scale is slow, unreliable, and wastes bandwidth. It also risks triggering anti-scraping measures.

The solution is to store raw content once at fetch time and re-use it for all subsequent processing.

## Decision

### Core Decision: Store Raw Content at Fetch Time

Store the original fetched bytes (HTML, PDF, etc.) in **Supabase Storage** immediately after a successful fetch, before any enrichment processing.

### Storage Location: Supabase Storage (not Postgres)

**Decision**: Use Supabase Storage buckets, not Postgres BYTEA columns.

**Rationale**:

- Postgres is not optimized for large blobs (performance, backup size, replication overhead)
- Supabase Storage is designed for files and supports signed URLs, access policies, and CDN delivery
- Storage is more cost-effective for large files

**Bucket structure**:

| Bucket     | Purpose                                  | Access            |
| ---------- | ---------------------------------------- | ----------------- |
| `kb-raw`   | Original fetched bytes (HTML, PDF, etc.) | Private           |
| `kb-thumb` | Thumbnails / preview images              | Private or Public |
| `kb-text`  | Extracted text artifacts (optional)      | Private           |

Alternative: Single bucket with prefixes (`raw/`, `thumb/`, `text/`).

### Key Naming: Pure Content-Addressed Keys

**Decision**: Use deterministic, content-addressed keys **without date in the path**.

**Pattern**: `raw/<hash>.<ext>`

**Examples**:

- `raw/ab12cd34ef56gh78....html`
- `raw/ef56gh78ab12cd34....pdf`

**Benefits**:

- **Truly idempotent uploads**: Same content always produces same key, regardless of fetch date
- **Natural deduplication**: Identical files share storage automatically
- **Reproducibility**: Hash proves content hasn't changed

**Date tracking**: Store `first_seen_at` and `fetched_at` as metadata columns, not in the key path. This preserves provenance without breaking idempotency.

**Why not include date in path?** Including `<yyyy>/<mm>/<dd>` would mean the same content fetched on different days produces different keys, breaking deduplication and the "same content = same key" invariant.

### When to Store: Immediately After Fetch (Stage 2)

**Decision**: Store raw bytes as early as possible—right after successful fetch, before any enrichment.

**Pipeline stages**:

| Stage           | Action                                   | Store Raw?         |
| --------------- | ---------------------------------------- | ------------------ |
| 0. Discover     | Find candidate URLs                      | No                 |
| 1. Pre-filter   | Cheap checks (allowlist, pattern, dedup) | No                 |
| 2. Fetch        | Download content (HTTP 200, non-empty)   | **Yes**            |
| 3. Parse/Enrich | Extract text, summarize, tag             | No (use `raw_ref`) |
| 4. Review       | Human approval                           | No (use `raw_ref`) |
| 5. Publish      | Promote to production                    | No                 |

**Rationale**: Storing at fetch time ensures:

- All enrichment stages work from the same immutable input
- Re-enrichment never requires re-fetching
- Failed enrichment can be retried without network dependency

### Retention Policy: Status-Based Lifecycle

**Decision**: Retain raw content based on item status, with garbage collection for rejected/expired items.

| Status                   | Retention                 | `expires_at`                 |
| ------------------------ | ------------------------- | ---------------------------- |
| `approved` / `published` | Indefinite (months/years) | `null`                       |
| `pending`                | 30–90 days                | `now() + interval '90 days'` |
| `rejected`               | 7–30 days                 | `now() + interval '14 days'` |

**Garbage collection job** (nightly):

1. Select rows where `expires_at < now()` and `storage_deleted_at is null`
2. **Reference check**: For each `raw_ref`, verify no other approved/published row references the same object (content-addressed keys may be shared)
3. Delete objects from Storage only if no live references exist
4. Set `storage_deleted_at = now()` (metadata and audit trail preserved)

**Reference-safe deletion rule**: GC must never delete a raw object that is still referenced by any approved, published, or pending item. This is critical because content-addressed keys enable deduplication—multiple items may share the same `raw_ref`.

**Implementation options**:

- **Option A (simple)**: Before deleting, query `SELECT 1 FROM ingestion_queue WHERE raw_ref = $1 AND status_code IN (approved, published, pending) LIMIT 1`
- **Option B (scalable)**: Maintain a `raw_object_refcount` table keyed by `content_hash`, incremented on insert, decremented on status change to rejected/deleted

### Schema Changes

Add these fields to `ingestion_queue` (and later `kb_item_request`):

| Column               | Type        | Description                                    |
| -------------------- | ----------- | ---------------------------------------------- |
| `raw_ref`            | text        | Storage key for raw bytes                      |
| `thumb_ref`          | text        | Storage key for thumbnail                      |
| `text_ref`           | text        | Storage key for extracted text (optional)      |
| `content_hash`       | text        | Hex-encoded SHA-256 hash (64 chars, no prefix) |
| `raw_store_mode`     | text        | `full`, `partial`, or `none` (see Size Limits) |
| `mime`               | text        | MIME type (from headers or sniffing)           |
| `etag`               | text        | HTTP ETag header (if available)                |
| `last_modified`      | timestamptz | HTTP Last-Modified header                      |
| `final_url`          | text        | URL after redirects (may differ from original) |
| `fetch_status`       | int         | HTTP status code from fetch                    |
| `fetch_error`        | text        | Error message if fetch failed                  |
| `fetched_at`         | timestamptz | When fetch occurred                            |
| `first_seen_at`      | timestamptz | When this content hash was first encountered   |
| `expires_at`         | timestamptz | When raw content may be deleted                |
| `storage_deleted_at` | timestamptz | When raw content was deleted                   |

**Hash format**: Store `content_hash` as plain hex (e.g., `ab12cd34ef56...`), not with a `sha256:` prefix. This simplifies queries and key construction.

**Example payload/row**:

```json
{
  "url": "https://example.com/report.pdf",
  "final_url": "https://cdn.example.com/report.pdf",
  "content_hash": "ab12cd34ef56gh78...",
  "mime": "application/pdf",
  "raw_ref": "raw/ab12cd34ef56gh78.pdf",
  "thumb_ref": "thumb/ab12cd34ef56gh78.png",
  "raw_store_mode": "full",
  "fetch_status": 200,
  "etag": "\"xyz123\"",
  "last_modified": "2026-01-20T12:00:00Z",
  "fetched_at": "2026-01-25T08:30:00Z",
  "first_seen_at": "2026-01-25T08:30:00Z"
}
```

### Access Control

**Decision**: Raw content buckets are **private** by default.

- **`kb-raw`**: Private. Only service role can read/write.
- **`kb-thumb`**: Private or public depending on UI needs. Use signed URLs for admin preview.
- Future: Premium users may access original PDFs via signed URLs (if licensing permits).

### Upload Mechanism

**Decision**: Prefer upload via Edge Function; direct agent upload as temporary implementation.

**Preferred approach (Edge Function)**:

- Create an ingest API (Supabase Edge Function or Render service) that:
  - Holds the service role key
  - Receives bytes + metadata from agent
  - Performs Storage upload + DB insert atomically
- Agent calls this API with a short-lived token or signed request
- **Benefit**: Service role key is never exposed in GitHub Actions secrets

**Temporary implementation (direct upload)**:

- Agent uses service role key directly for Storage uploads
- **Risk**: Service role key becomes a high-value secret in CI environment
- **Mitigation**: Use GitHub Actions environment protection rules; rotate key periodically

```js
const rawKey = `raw/${hash}.${ext}`;
await storage.from('kb-raw').upload(rawKey, bytes, { contentType: mime, upsert: true });
```

**Note**: Use `upsert: true` since content-addressed keys are idempotent—re-uploading the same content to the same key is a no-op.

### Size Limits and Oversize Handling

**Decision**: Store files up to 50 MB. For larger files, define explicit fallback behavior.

**`raw_store_mode` values**:

| Mode      | Behavior                 | When used                               |
| --------- | ------------------------ | --------------------------------------- |
| `full`    | Store complete raw bytes | Size ≤ 50 MB                            |
| `partial` | Store first 5 MB sample  | Size > 50 MB, want debugging capability |
| `none`    | Store only metadata      | Size > 50 MB, no partial needed         |

**For oversized files (> 50 MB)**:

1. **Still compute `content_hash`**: Hash can be computed via streaming without storing full bytes
2. **Store first-page thumbnail**: Capture preview for admin UI
3. **Set `raw_store_mode = 'partial'` or `'none'`**
4. **Record `oversize_bytes`**: Actual file size for reporting

**Rationale**: Prevents storage cost explosion while maintaining:

- Reproducibility (hash proves identity)
- Debugging capability (partial sample)
- Admin preview (thumbnail)

**Edge cases**:

- Large HTML pages (> 50 MB): Rare; typically indicates infinite scroll or embedded data. Store partial.
- ZIP/archive files: Store metadata only; consider extracting manifest.
- Video/audio: Store metadata + thumbnail/waveform only.

### Legal, Compliance, and Robots Policy

**Decision**: Document content storage policy and implement takedown capability.

**Robots.txt policy**:

- Honor `robots.txt` directives for discovery/crawling
- Document any exceptions (e.g., content we have explicit permission to index)
- Store `robots_allowed` boolean if relevant for audit

**Third-party content storage**:

- Store only what our use case permits
- For paywalled/licensed content: store metadata and derived text if allowed; raw PDF storage may require license review
- Maintain `content_license` field if source provides license metadata

**Takedown mechanism**:

- Implement admin endpoint to delete raw content by `content_hash` or `source_url`
- Log takedown requests with timestamp and requester
- Retention exceptions: some content may require accelerated deletion (legal request, copyright claim)

**Audit trail**:

- Keep metadata rows even after raw content is deleted (`storage_deleted_at` populated)
- Record reason for deletion (`deletion_reason` field)

## Consequences

### Positive

- **Reproducibility**: Re-enrichment uses exact original bytes
- **Resilience**: No dependency on source URL availability
- **Speed**: Re-processing is I/O from Storage, not network fetches
- **Cost control**: Fetch once, process many times
- **Audit trail**: Hash proves content provenance
- **Deduplication**: Content-addressed keys naturally dedupe
- **Legal clarity**: Explicit policies for third-party content and takedowns

### Negative / Costs

- **Storage cost**: ~10–100 KB per HTML, ~1–5 MB per PDF. At 100 items/day, ~50–150 GB/year for PDFs.
- **Complexity**: New fields, upload logic, garbage collection job
- **Migration**: Existing items have no `raw_ref`; must re-fetch or mark as "no raw available"
- **Reference tracking**: GC must check for shared references before deleting

## Alternatives Considered

### 1. Store raw in Postgres BYTEA

- **Rejected**: Poor performance for large blobs, inflates backup size, complicates replication.

### 2. Store only extracted text, not raw bytes

- **Rejected**: Cannot re-extract if extraction logic changes; loses PDF formatting, images, metadata.

### 3. Re-fetch on demand

- **Rejected**: Current approach. Known problems: URLs go stale, paywalls, rate limits, reproducibility loss.

### 4. Store raw only after enrichment passes

- **Rejected**: Requires bytes for enrichment anyway; either store before or risk double-fetch.

### 5. External object storage (S3, GCS)

- **Deferred**: Supabase Storage is sufficient for current scale and keeps infrastructure unified.

## Rollout Plan

### Phase 1: Infrastructure (Immediate)

1. Create Storage bucket `kb-raw` (private)
2. Add schema columns to `ingestion_queue`:
   - `raw_ref`, `content_hash`, `mime`, `fetched_at`, `expires_at`, `storage_deleted_at`

### Phase 2: Fetcher Integration

1. Update fetcher agent to:
   - Compute `content_hash` after successful fetch
   - Upload bytes to Storage with content-addressed key
   - Store `raw_ref` in queue payload/columns
2. Add size limit check (skip upload if > 50 MB)

### Phase 3: Enrichment Integration

1. Update enricher to read from `raw_ref` instead of re-fetching URL
2. Fall back to URL fetch if `raw_ref` is null (legacy items)

### Phase 4: Retention & Garbage Collection

1. Implement `expires_at` computation on status change
2. Create nightly garbage collection job
3. Add `storage_deleted_at` tracking

### Phase 5: Admin Preview

1. Update admin review UI to use signed URLs for `raw_ref` preview
2. Add "View Original" button for approved items

## References

- Supabase Storage documentation: https://supabase.com/docs/guides/storage
- ADR-003: Canonical Item + Change Request Model (defines `kb_item`, `kb_item_request`)
- `ingestion_queue` schema: `docs/data-model/schema.md`
- Content-addressed storage patterns: IPFS, Git object model
