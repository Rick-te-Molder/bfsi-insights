# Backlog: Raw Data Storage Implementation

## Summary

Implement raw data storage as specified in [ADR-004](../architecture/decisions/adr-004-raw-data-storage.md). Store original fetched content (PDF, HTML) in Supabase Storage to enable reproducible re-enrichment without re-fetching.

## Status

**Planning** - Stories refined, ready for implementation

## Context

Currently, BFSI Insights does not store the original fetched content after processing. This forces re-fetching every publication when we upgrade enrichment logic, which is:

- **Expensive**: Network bandwidth and time
- **Unreliable**: URLs go stale, paywalls appear, rate limits hit
- **Non-reproducible**: Cannot explain why a summary changed

The ADR specifies storing raw bytes at fetch time in Supabase Storage with content-addressed keys.

---

# Cross-Cutting Decisions

These decisions apply across all stories:

| Decision                    | Choice                                        | Rationale                               |
| --------------------------- | --------------------------------------------- | --------------------------------------- |
| **Status field**            | Use `status_code` (int FK to `status_lookup`) | Project standard per .windsurfrules     |
| **Hash format**             | 64-char lowercase hex `[0-9a-f]{64}`          | SHA-256 standard                        |
| **Storage key pattern**     | `<hash>.<ext>` (no `raw/` prefix)             | Bucket already namespaces; simpler keys |
| **Extension determination** | Prefer byte sniffing over Content-Type header | Handles bad servers                     |
| **GC row updates**          | Update ALL rows sharing `raw_ref` on deletion | Prevents re-processing deleted objects  |

---

# User Stories

## US-0: Raw Object Registry (Recommended)

**As a** platform operator  
**I want** a centralized registry of raw objects  
**So that** first_seen_at, deduplication, and reference counting are reliable

### Acceptance Criteria

- [ ] Create `raw_object` table:
  - `content_hash` (text, PK) — 64-char hex SHA-256
  - `raw_ref` (text, not null) — Storage key
  - `first_seen_at` (timestamptz, not null, default now())
  - `mime_detected` (text) — MIME from byte sniffing
  - `bytes` (bigint) — File size
  - `raw_store_mode` (text) — `full`, `partial`, or `none`
- [ ] Add CHECK constraint: `content_hash ~ '^[0-9a-f]{64}$'`
- [ ] Add CHECK constraint: `raw_store_mode IN ('full', 'partial', 'none')`
- [ ] Index on `raw_ref` for GC lookups
- [ ] Optional: `takedown_blocklist` table for preventing re-ingestion

### Technical Notes

**Schema**:

```sql
CREATE TABLE raw_object (
  content_hash text PRIMARY KEY CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  raw_ref text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  mime_detected text,
  bytes bigint,
  raw_store_mode text CHECK (raw_store_mode IN ('full', 'partial', 'none'))
);

CREATE INDEX idx_raw_object_raw_ref ON raw_object(raw_ref);

-- Optional: blocklist for takedowns
CREATE TABLE takedown_blocklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_hash text REFERENCES raw_object(content_hash),
  url_pattern text,
  reason text NOT NULL,
  requested_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT has_target CHECK (content_hash IS NOT NULL OR url_pattern IS NOT NULL)
);
```

**Benefits**:

- `first_seen_at` is always correct (UPSERT on `raw_object`)
- Reference counting is a simple `COUNT(*)` on `ingestion_queue` by `content_hash`
- Takedown blocklist prevents re-ingestion

### Files to Create/Modify

- `supabase/migrations/YYYYMMDD_raw_object_registry.sql` — Schema migration
- `docs/data-model/schema.md` — Update with new tables

### Dependencies

None (foundational)

### Estimate

**Small** (1-2 hours)

---

## US-1: Infrastructure Setup

**As a** platform operator  
**I want** the storage infrastructure provisioned  
**So that** the fetcher can begin storing raw content

### Acceptance Criteria

- [ ] Storage bucket `kb-raw` created (private)
- [ ] Storage bucket `kb-thumb` created (private)
- [ ] Buckets are private; anon/authenticated users have no direct access; only server-side/service role uses them
- [ ] Schema migration adds columns to `ingestion_queue`:
  - `raw_ref` (text, nullable) — FK concept to `raw_object.raw_ref`
  - `thumb_ref` (text, nullable)
  - `content_hash` (text, nullable) — FK to `raw_object.content_hash`
  - `mime` (text, nullable)
  - `final_url` (text, nullable) — URL after redirects
  - `original_url` (text, nullable) — URL before redirects (if different)
  - `fetch_status` (int, nullable) — CHECK `fetch_status >= 0`
  - `fetch_error` (text, nullable)
  - `fetched_at` (timestamptz, nullable)
  - `expires_at` (timestamptz, nullable)
  - `storage_deleted_at` (timestamptz, nullable)
  - `deletion_reason` (text, nullable) — For audit trail
  - `oversize_bytes` (bigint, nullable) — Actual size when > 50 MB
- [ ] Add CHECK constraint: `content_hash ~ '^[0-9a-f]{64}$'` (if not using FK)
- [ ] Add CHECK constraint: `fetch_status >= 0`
- [ ] Index on `content_hash` for deduplication lookups
- [ ] Index on `raw_ref` for GC and takedown updates
- [ ] Index on `expires_at` for GC queries
- [ ] Composite index on `(raw_ref, status_code)` for reference checks

### Technical Notes

**Bucket creation** (Supabase Dashboard or SQL):

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('kb-raw', 'kb-raw', false);

INSERT INTO storage.buckets (id, name, public)
VALUES ('kb-thumb', 'kb-thumb', false);
```

**Note on RLS**: Service role bypasses RLS entirely. The protection comes from:

- `public = false` on buckets
- No RLS policies granting access to `anon` or `authenticated` roles
- Keeping service role key server-side only

**Schema migration**:

```sql
ALTER TABLE ingestion_queue
  ADD COLUMN raw_ref text,
  ADD COLUMN thumb_ref text,
  ADD COLUMN content_hash text CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  ADD COLUMN mime text,
  ADD COLUMN final_url text,
  ADD COLUMN original_url text,
  ADD COLUMN fetch_status int CHECK (fetch_status >= 0),
  ADD COLUMN fetch_error text,
  ADD COLUMN fetched_at timestamptz,
  ADD COLUMN expires_at timestamptz,
  ADD COLUMN storage_deleted_at timestamptz,
  ADD COLUMN deletion_reason text,
  ADD COLUMN oversize_bytes bigint;

CREATE INDEX idx_iq_content_hash ON ingestion_queue(content_hash);
CREATE INDEX idx_iq_raw_ref ON ingestion_queue(raw_ref);
CREATE INDEX idx_iq_expires_at ON ingestion_queue(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_iq_raw_ref_status ON ingestion_queue(raw_ref, status_code);
```

### Files to Create/Modify

- `supabase/migrations/YYYYMMDD_raw_storage_schema.sql` — Schema migration
- `docs/data-model/schema.md` — Update with new columns

### Dependencies

- US-0 (Raw Object Registry) — If using FK to `raw_object`

### Estimate

**Small** (1-2 hours)

---

## US-2: Fetcher Integration — Store Raw Content

**As a** pipeline operator  
**I want** the fetcher to store raw bytes after successful fetch  
**So that** content is preserved for re-enrichment

### Acceptance Criteria

- [ ] After successful HTTP fetch (status 2xx, non-empty body):
  1. Compute SHA-256 hash of response bytes
  2. Determine file extension via byte sniffing (fallback to Content-Type header)
  3. Upload to `kb-raw` bucket with key `<hash>.<ext>`
  4. Use `upsert: true` (content-addressed = idempotent)
  5. UPSERT into `raw_object` table to set `first_seen_at` correctly
- [ ] Store metadata in `ingestion_queue` row:
  - `raw_ref` = storage key (e.g., `a1b2c3d4e5f6...64chars.pdf`)
  - `content_hash` = hex hash (64 lowercase chars, no prefix)
  - `mime` = detected MIME type
  - `final_url` = URL after redirects
  - `original_url` = original URL (if redirected)
  - `fetch_status` = HTTP status code
  - `fetched_at` = current timestamp
- [ ] On fetch failure:
  - `fetch_status` = HTTP status code (or 0 for network error)
  - `fetch_error` = error message
  - `raw_ref` = null
- [ ] Unit tests cover:
  - Successful fetch → upload + metadata
  - Failed fetch → error fields populated
  - Duplicate content → same `raw_ref` (idempotent)
  - Redirect handling → `final_url` differs from `original_url`
  - MIME mismatch → byte sniffing wins over header

### Technical Notes

**Hash computation**:

```js
import crypto from 'crypto';

function computeHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
```

**Byte sniffing for extension** (prefer over Content-Type):

```js
function detectExtension(buffer, contentType) {
  // PDF magic: %PDF
  if (buffer.slice(0, 4).toString() === '%PDF') return 'pdf';
  // HTML: starts with <!DOCTYPE or <html
  const start = buffer.slice(0, 100).toString().trim().toLowerCase();
  if (start.startsWith('<!doctype html') || start.startsWith('<html')) return 'html';
  // Fallback to Content-Type
  const MIME_EXT = {
    'text/html': 'html',
    'application/pdf': 'pdf',
    'application/json': 'json',
    'text/plain': 'txt',
  };
  return MIME_EXT[contentType?.split(';')[0]] || 'bin';
}
```

**Upload with upsert** (key without `raw/` prefix since bucket namespaces):

```js
const rawKey = `${hash}.${ext}`;
await supabase.storage.from('kb-raw').upload(rawKey, bytes, { contentType: mime, upsert: true });
```

**UPSERT into raw_object** (ensures correct `first_seen_at`):

```js
await supabase.from('raw_object').upsert(
  {
    content_hash: hash,
    raw_ref: rawKey,
    mime_detected: mime,
    bytes: buffer.length,
    raw_store_mode: 'full',
  },
  { onConflict: 'content_hash', ignoreDuplicates: true },
);
```

### Files to Create/Modify

- `services/agent-api/src/lib/raw-storage.js` — New module for storage operations
- `services/agent-api/src/agents/fetcher.js` — Integrate raw storage after fetch
- `services/agent-api/tests/lib/raw-storage.spec.js` — Unit tests

### Dependencies

- US-0 (Raw Object Registry)
- US-1 (Infrastructure Setup)

### Estimate

**Medium** (3-4 hours)

---

## US-3: Size Limit Handling

**As a** pipeline operator  
**I want** oversized files (> 50 MB) handled gracefully  
**So that** storage costs are controlled without losing all metadata

### Acceptance Criteria

- [ ] Files ≤ 50 MB: store full content (`raw_store_mode = 'full'`)
- [ ] Files > 50 MB:
  - Still compute `content_hash` via streaming (hash while downloading)
  - Set `raw_store_mode = 'none'`
  - Set `raw_ref = null`
  - Set `oversize_bytes` = actual file size
  - Log warning with file size
  - Still generate thumbnail if possible
- [ ] UPSERT into `raw_object` with `raw_store_mode = 'none'`

**Deferred (not MVP)**:

- Partial mode: Store first 5 MB as `<hash>_partial.<ext>`
- Set `raw_store_mode = 'partial'`

### Technical Notes

**Streaming hash while downloading** (avoids buffering full content):

```js
import crypto from 'crypto';
import { Writable } from 'stream';

async function hashStreamWithLimit(readable, maxBytes) {
  const hash = crypto.createHash('sha256');
  let totalBytes = 0;
  let isOversize = false;
  const chunks = [];

  for await (const chunk of readable) {
    hash.update(chunk);
    totalBytes += chunk.length;
    if (totalBytes <= maxBytes) {
      chunks.push(chunk);
    } else {
      isOversize = true;
    }
  }

  return {
    contentHash: hash.digest('hex'),
    bytes: totalBytes,
    isOversize,
    buffer: isOversize ? null : Buffer.concat(chunks),
  };
}
```

**Note**: This approach hashes the full stream but only buffers up to `maxBytes`. For very large files, we hash without storing.

### Files to Create/Modify

- `services/agent-api/src/lib/raw-storage.js` — Add size check logic
- `services/agent-api/src/lib/constants.js` — `RAW_STORAGE_MAX_BYTES = 50 * 1024 * 1024`

### Dependencies

- US-2 (Fetcher Integration)

### Estimate

**Small** (1-2 hours)

---

## US-4: Enricher Integration — Read from Storage

**As a** pipeline operator  
**I want** the enricher to read from stored raw content  
**So that** re-enrichment doesn't require re-fetching

### Acceptance Criteria

- [ ] Before enrichment, check if `raw_ref` exists and `storage_deleted_at` is null:
  - If yes: download from Storage and use those bytes
  - If no: fall back to fetching from original URL (legacy behavior)
- [ ] Log which path was taken (`source: storage` vs `source: url`)
- [ ] Metrics: track `enrichment_source` in `agent_run_metric`
- [ ] On storage download failure:
  - Log `storage_miss` with error
  - Fall back to URL fetch
  - Continue processing (don't fail the job)
- [ ] Unit tests cover:
  - Read from storage when `raw_ref` present
  - Fallback to URL when `raw_ref` is null
  - Fallback to URL when storage download fails
  - Skip storage for `raw_store_mode = 'none'`

### Technical Notes

**Download from storage with fallback**:

```js
async function getRawContent(item) {
  // Skip if no raw_ref or already deleted
  if (!item.raw_ref || item.storage_deleted_at) {
    return { source: 'url', bytes: await fetchFromUrl(item.url) };
  }

  try {
    const { data, error } = await supabase.storage.from('kb-raw').download(item.raw_ref);
    if (error) throw error;
    return { source: 'storage', bytes: Buffer.from(await data.arrayBuffer()) };
  } catch (err) {
    console.warn(`storage_miss: ${item.raw_ref}`, err.message);
    return { source: 'url', bytes: await fetchFromUrl(item.url) };
  }
}
```

**Memory consideration**: For large PDFs (up to 50 MB), ensure the enricher handles memory appropriately. Consider streaming where possible. Note as follow-up if needed.

### Files to Create/Modify

- `services/agent-api/src/lib/raw-storage.js` — Add `getRawContent()` function
- `services/agent-api/src/agents/enricher.js` — Use storage instead of fetch
- `services/agent-api/tests/lib/raw-storage.spec.js` — Add download tests

### Dependencies

- US-2 (Fetcher Integration)

### Estimate

**Medium** (2-3 hours)

---

## US-5: Retention Policy — Set Expiration on Status Change

**As a** platform operator  
**I want** raw content expiration set based on item status  
**So that** rejected items don't consume storage indefinitely

### Acceptance Criteria

- [ ] On status change to rejected `status_code`: set `expires_at = now() + 14 days`
- [ ] On status change to approved/published `status_code`: set `expires_at = null`
- [ ] On initial insert (pending `status_code`): set `expires_at = now() + 90 days`
- [ ] Implement via database trigger (preferred) to catch all update paths
- [ ] For `raw_store_mode = 'none'`: still set `expires_at` (GC will update `storage_deleted_at` even if no file to delete)
- [ ] Unit tests verify `expires_at` is set correctly for each status transition

### Technical Notes

**Retention policy** (from ADR):

| `status_code` (via `status_lookup`) | Retention  | `expires_at`      |
| ----------------------------------- | ---------- | ----------------- |
| approved / published                | Indefinite | `null`            |
| pending                             | 90 days    | `now() + 90 days` |
| rejected                            | 14 days    | `now() + 14 days` |

**DB trigger** (recommended to catch all update paths):

```sql
CREATE OR REPLACE FUNCTION set_raw_expiration()
RETURNS TRIGGER AS $$
DECLARE
  rejected_codes int[];
  approved_codes int[];
BEGIN
  -- Get status codes dynamically from status_lookup
  SELECT array_agg(code) INTO rejected_codes
  FROM status_lookup WHERE status = 'rejected';

  SELECT array_agg(code) INTO approved_codes
  FROM status_lookup WHERE status IN ('approved', 'published');

  IF NEW.status_code = ANY(rejected_codes) THEN
    NEW.expires_at := now() + interval '14 days';
  ELSIF NEW.status_code = ANY(approved_codes) THEN
    NEW.expires_at := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    -- New pending items get 90 days
    NEW.expires_at := COALESCE(NEW.expires_at, now() + interval '90 days');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_raw_expiration
BEFORE INSERT OR UPDATE OF status_code ON ingestion_queue
FOR EACH ROW EXECUTE FUNCTION set_raw_expiration();
```

### Files to Create/Modify

- `supabase/migrations/YYYYMMDD_raw_expiration_trigger.sql` — DB trigger

### Dependencies

- US-1 (Infrastructure Setup)

### Estimate

**Small** (1-2 hours)

---

## US-6: Garbage Collection Job

**As a** platform operator  
**I want** expired raw content deleted nightly  
**So that** storage costs are controlled

### Acceptance Criteria

- [ ] Nightly job (cron or scheduled function) runs GC
- [ ] **Reference-safe deletion**: Before deleting, check no row with live `status_code` references the same `raw_ref`
- [ ] For each safe-to-delete `raw_ref`:
  1. Delete from Storage (`kb-raw` bucket)
  2. Also delete `thumb_ref` from `kb-thumb` if present
  3. **Update ALL rows** with that `raw_ref`: set `storage_deleted_at = now()`, `deletion_reason = 'gc'`
- [ ] Log: count of objects deleted, count skipped (still referenced), count of rows updated
- [ ] Dry-run mode for testing
- [ ] Batch limit: max 100 deletions per run to avoid long runtime
- [ ] Concurrency safety: use advisory lock or mark rows "gc_in_progress"

### Technical Notes

**Reference-safe deletion query** (using NOT EXISTS for null safety and performance):

```sql
WITH expired_refs AS (
  SELECT DISTINCT raw_ref
  FROM ingestion_queue
  WHERE expires_at < now()
    AND storage_deleted_at IS NULL
    AND raw_ref IS NOT NULL
),
safe_to_delete AS (
  SELECT e.raw_ref
  FROM expired_refs e
  WHERE NOT EXISTS (
    SELECT 1 FROM ingestion_queue iq
    JOIN status_lookup sl ON iq.status_code = sl.code
    WHERE iq.raw_ref = e.raw_ref
      AND sl.status IN ('approved', 'published', 'pending')
  )
  LIMIT 100  -- Batch limit
)
SELECT raw_ref FROM safe_to_delete;
```

**Critical: Update ALL rows sharing the deleted raw_ref**:

```js
// After deleting from storage
await supabase
  .from('ingestion_queue')
  .update({
    storage_deleted_at: new Date().toISOString(),
    deletion_reason: 'gc',
  })
  .eq('raw_ref', rawRef);
```

This prevents future GC runs from trying to delete non-existent objects.

**Delete from storage** (both buckets):

```js
await supabase.storage.from('kb-raw').remove([rawRef]);
// Also delete thumb if pattern matches
const thumbRef = rawRef.replace(/\.[^.]+$/, '.png');
await supabase.storage.from('kb-thumb').remove([thumbRef]);
```

**Advisory lock for concurrency**:

```sql
SELECT pg_advisory_lock(hashtext('gc_raw_storage'));
-- ... run GC ...
SELECT pg_advisory_unlock(hashtext('gc_raw_storage'));
```

### Files to Create/Modify

- `services/agent-api/src/cli/commands/gc-raw-storage.js` — New CLI command
- `services/agent-api/src/cli/index.js` — Register GC command
- `.github/workflows/nightly.yml` — Add GC job (or schedule via Supabase)
- `services/agent-api/tests/cli/commands/gc-raw-storage.spec.js` — Unit tests

### Dependencies

- US-5 (Retention Policy)

### Estimate

**Medium** (3-4 hours)

---

## US-7: Admin Preview — Signed URLs

**As an** admin reviewer  
**I want** to view the original content in the review UI  
**So that** I can verify enrichment quality against source

### Acceptance Criteria

- [ ] API endpoints:
  - `GET /api/raw-content/by-queue/:queueId` — Get signed URL by queue ID
  - `GET /api/raw-content/by-hash/:hash` — Get signed URL by content hash (for ops)
- [ ] Signed URL expires in 1 hour
- [ ] Admin UI: "View Original" button opens signed URL in new tab
- [ ] Handle missing/deleted `raw_ref` gracefully:
  - If `raw_ref` is null: show "Original not stored"
  - If `storage_deleted_at` is set: show "Original was deleted"
- [ ] Authorization: only authenticated admin users can request signed URLs

### Technical Notes

**Endpoint by queue ID**:

```js
router.get('/by-queue/:queueId', async (req, res) => {
  const { queueId } = req.params;
  const { data: item } = await supabase
    .from('ingestion_queue')
    .select('raw_ref, storage_deleted_at')
    .eq('id', queueId)
    .single();

  if (!item?.raw_ref) {
    return res.status(404).json({ error: 'Original not stored' });
  }
  if (item.storage_deleted_at) {
    return res.status(410).json({ error: 'Original was deleted' });
  }

  const { data } = await supabase.storage.from('kb-raw').createSignedUrl(item.raw_ref, 3600);
  return res.json({ signedUrl: data.signedUrl });
});
```

### Files to Create/Modify

- `services/agent-api/src/routes/raw-content.js` — New route for signed URLs
- `apps/admin/src/app/(dashboard)/review/[id]/page.tsx` — Add "View Original" button
- `apps/admin/src/lib/api.ts` — Add `getRawContentUrl()` helper

### Dependencies

- US-2 (Fetcher Integration)

### Estimate

**Medium** (2-3 hours)

---

## US-8: Takedown Capability

**As a** platform operator  
**I want** to delete raw content on demand (legal/compliance)  
**So that** we can respond to takedown requests

### Acceptance Criteria

- [ ] Admin endpoints:
  - `DELETE /api/raw-content/by-queue/:queueId` — Delete by queue ID
  - `DELETE /api/raw-content/by-hash/:hash` — Delete by content hash (affects all rows)
- [ ] Deletes from Storage (`kb-raw` and `kb-thumb`)
- [ ] **Updates ALL rows** with that `raw_ref`: set `storage_deleted_at`, `deletion_reason`
- [ ] Logs takedown to `takedown_log` table with timestamp, requester, reason, target, outcome
- [ ] Adds `content_hash` to `takedown_blocklist` to prevent re-ingestion
- [ ] Metadata rows preserved (audit trail)
- [ ] Authorization: only admin users can perform takedowns

### Technical Notes

**Takedown with audit and blocklist**:

```js
async function takedownByHash(contentHash, reason, requestedBy) {
  // Get raw_ref from raw_object
  const { data: obj } = await supabase
    .from('raw_object')
    .select('raw_ref')
    .eq('content_hash', contentHash)
    .single();

  if (!obj?.raw_ref) {
    return { success: false, error: 'Content not found' };
  }

  // Delete from storage
  await supabase.storage.from('kb-raw').remove([obj.raw_ref]);
  const thumbRef = obj.raw_ref.replace(/\.[^.]+$/, '.png');
  await supabase.storage.from('kb-thumb').remove([thumbRef]);

  // Update ALL rows referencing this raw_ref
  const { count } = await supabase
    .from('ingestion_queue')
    .update({
      storage_deleted_at: new Date().toISOString(),
      deletion_reason: `takedown: ${reason}`,
    })
    .eq('raw_ref', obj.raw_ref);

  // Add to blocklist
  await supabase.from('takedown_blocklist').insert({
    content_hash: contentHash,
    reason,
    requested_by: requestedBy,
  });

  // Log to takedown_log
  await supabase.from('takedown_log').insert({
    target_type: 'content_hash',
    target_value: contentHash,
    raw_ref: obj.raw_ref,
    reason,
    requested_by: requestedBy,
    rows_affected: count,
    outcome: 'success',
  });

  return { success: true, rowsAffected: count };
}
```

**Takedown log table** (add in US-0 or here):

```sql
CREATE TABLE takedown_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL, -- 'content_hash', 'url', 'queue_id'
  target_value text NOT NULL,
  raw_ref text,
  reason text NOT NULL,
  requested_by text NOT NULL,
  rows_affected int,
  outcome text NOT NULL, -- 'success', 'not_found', 'error'
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### Files to Create/Modify

- `supabase/migrations/YYYYMMDD_takedown_tables.sql` — Add `takedown_log` (if not in US-0)
- `services/agent-api/src/routes/raw-content.js` — Add DELETE endpoints
- `services/agent-api/src/lib/raw-storage.js` — Add `takedownByHash()` function
- `docs/operations/takedown-procedure.md` — Document process

### Dependencies

- US-0 (Raw Object Registry) — For blocklist table
- US-6 (Garbage Collection) — For deletion patterns

### Estimate

**Medium** (2-3 hours)

---

# Implementation Order

| Order | Story | Effort | Cumulative | Notes                         |
| ----- | ----- | ------ | ---------- | ----------------------------- |
| 1     | US-0  | Small  | 2h         | Registry table (recommended)  |
| 2     | US-1  | Small  | 4h         | Buckets + schema columns      |
| 3     | US-2  | Medium | 8h         | Fetcher stores raw content    |
| 4     | US-4  | Medium | 11h        | Enricher reads from storage   |
| 5     | US-5  | Small  | 13h        | Retention trigger             |
| 6     | US-6  | Medium | 17h        | GC prevents unbounded growth  |
| 7     | US-3  | Small  | 19h        | Oversize handling (if needed) |
| 8     | US-7  | Medium | 22h        | Admin preview                 |
| 9     | US-8  | Medium | 25h        | Takedown capability           |

**Total estimate**: ~25 hours (4-5 days)

## MVP Scope

For a minimal viable implementation, prioritize:

1. **US-0** (Raw Object Registry) — Simplifies everything else
2. **US-1** (Infrastructure) — Required foundation
3. **US-2** (Fetcher Integration) — Core value
4. **US-4** (Enricher Integration) — Enables re-enrichment
5. **US-5** (Retention Policy) — Sets expiration
6. **US-6** (Garbage Collection) — Prevents unbounded storage growth

This gives reproducible enrichment with controlled storage in ~17 hours.

**Deferred from MVP**:

- US-3 (Oversize handling) — Implement when you see > 50 MB files in practice
- US-7 (Admin preview) — Nice-to-have for review workflow
- US-8 (Takedown) — Implement when compliance requires it

---

# References

- [ADR-004: Raw Data Storage Strategy](../architecture/decisions/adr-004-raw-data-storage.md)
- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [Schema Reference](../data-model/schema.md)
