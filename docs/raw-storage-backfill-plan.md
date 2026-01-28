# Raw Storage Backfill Plan

## Current Situation

**Total items**: 2,709
**Items with raw storage**: 1 (0.04%)
**Items needing backfill**: 2,708 (99.96%)

### Breakdown by Status

- **2,141 items** in review or published (status >= 300) - **HIGH PRIORITY**
- **567 items** in enrichment (status 200-299) - **MEDIUM PRIORITY**
- **1 item** already has storage

## Why Only 1 Item Has Storage

Raw storage was implemented on **Jan 25, 2026** (migration `20260125221300_raw_object_registry.sql`).

All 2,708 items without storage were:

1. Discovered and fetched **before Jan 25, 2026**
2. Processed through the old fetch logic that didn't store raw content
3. Now sitting in various pipeline stages without their original PDFs/text

The 1 item with storage was likely:

- Fetched **after Jan 25** when raw storage was enabled
- Or manually tested during implementation

## Backfill Strategy

### Priority Tiers

**Tier 1: Published Items (Status 400)**

- These are live on your site
- Most valuable for re-enrichment and compliance
- Estimate: ~142 items (based on published count)

**Tier 2: Review Items (Status 300-330)**

- About to be published
- Need raw content for quality checks
- Estimate: ~49 items (2,141 - 142 = ~1,999 in review/approved)

**Tier 3: Enriched Items (Status 200-299)**

- May need re-enrichment
- Lower priority
- Estimate: ~567 items

**Tier 4: Discovery Items (Status < 200)**

- Can be re-fetched naturally
- Lowest priority

### Approach

**Option A: Agent API Endpoint (Recommended)**
Create a backfill endpoint in agent-api that:

1. Queries items without `raw_ref`
2. Calls `fetchAndStoreRaw(url)` for each
3. Updates `ingestion_queue` with `raw_ref`, `content_hash`, etc.
4. Processes in batches with rate limiting

**Option B: Manual SQL + Storage Upload**

1. Export URLs from database
2. Download content locally
3. Upload to Supabase Storage
4. Update database records

**Option C: Gradual Natural Backfill**

- Wait for items to be re-enriched naturally
- Each re-enrichment will store raw content
- Slowest but zero effort

## Recommended Action Plan

### Phase 1: Immediate (Published Items)

```bash
# Backfill all published items
POST /api/backfill-raw-storage
{
  "minStatus": 400,
  "maxStatus": 400,
  "batchSize": 5,
  "delayMs": 2000
}
```

### Phase 2: Short-term (Review Items)

```bash
# Backfill items in review
POST /api/backfill-raw-storage
{
  "minStatus": 300,
  "maxStatus": 399,
  "batchSize": 10,
  "delayMs": 1000
}
```

### Phase 3: Long-term (Enriched Items)

- Run during off-peak hours
- Lower priority
- Can skip if storage costs are a concern

## Storage Estimates

Assuming average file size of **500 KB** per item:

- **Tier 1 (142 items)**: ~71 MB
- **Tier 2 (1,999 items)**: ~1 GB
- **Tier 3 (567 items)**: ~284 MB
- **Total (2,708 items)**: ~1.35 GB

Supabase free tier: **1 GB storage**
Supabase Pro tier: **100 GB storage**

**Recommendation**: Start with Tier 1 (published items) to stay within free tier limits.

## Implementation Files

1. **Investigation Script**: `scripts/investigate-raw-storage.sql`
   - Analyze current state
   - Identify items needing backfill

2. **Backfill Endpoint**: `services/agent-api/src/routes/backfill-raw-storage.js` (to be created)
   - REST endpoint for controlled backfilling
   - Rate limiting and error handling
   - Progress tracking

3. **Monitoring Query**: `scripts/check-raw-storage-counts.sql`
   - Track backfill progress
   - Monitor storage usage

## Next Steps

1. ✅ **Investigate** - Understand why only 1 item has storage (DONE)
2. ✅ **Confirm** - Raw storage is enabled for new items (DONE)
3. ⏳ **Create** - Backfill endpoint in agent-api
4. ⏳ **Test** - Backfill 5-10 published items
5. ⏳ **Execute** - Backfill all published items (Tier 1)
6. ⏳ **Monitor** - Check storage usage and success rate
7. ⏳ **Expand** - Backfill review items (Tier 2) if storage allows
