# Raw Storage Backfill - Quick Summary

## Current State

- **Total items in queue**: 2,709
- **Items with raw storage**: 1
- **Items needing backfill**: 795 (focusing on valuable items only)

## Backfill Scope (Prioritized)

### Tier 1: Published Items

- **Count**: 162 items
- **Status**: 400 (published)
- **Priority**: HIGHEST - These are live on your site
- **Estimated storage**: ~81 MB (at 500 KB/item)

### Tier 2: Review Items

- **Count**: 66 items
- **Status**: 300 (pending_review)
- **Priority**: HIGH - About to be published
- **Estimated storage**: ~33 MB

### Tier 3: Enrichment Items

- **Count**: 567 items
- **Status**: 200-299 (enrichment stages)
- **Priority**: MEDIUM - May need re-enrichment
- **Estimated storage**: ~284 MB

**Total**: 795 items, ~398 MB storage needed

## Why These Items Don't Have Storage

Raw storage was implemented on **Jan 25, 2026**. All 795 items were:

1. Fetched **before Jan 25**
2. Processed through old fetch logic (no storage)
3. Now sitting in enrichment/review/published without raw content

## Solution Created

### 1. Backfill Endpoint

**File**: `services/agent-api/src/routes/backfill-raw-storage.js`

**Usage**:

```bash
# Backfill published items (162 items)
curl -X POST http://localhost:3000/api/backfill-raw-storage \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "minStatus": 400,
    "maxStatus": 400,
    "limit": 162,
    "batchSize": 5,
    "delayMs": 2000
  }'

# Backfill review items (66 items)
curl -X POST http://localhost:3000/api/backfill-raw-storage \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "minStatus": 300,
    "maxStatus": 300,
    "limit": 66,
    "batchSize": 5,
    "delayMs": 2000
  }'

# Backfill enrichment items (567 items)
curl -X POST http://localhost:3000/api/backfill-raw-storage \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "minStatus": 200,
    "maxStatus": 299,
    "limit": 567,
    "batchSize": 10,
    "delayMs": 1000
  }'
```

### 2. Investigation Queries

**File**: `scripts/investigate-raw-storage.sql`

- Check current storage status
- Identify items needing backfill
- Analyze by status and date

### 3. Monitoring Queries

**File**: `scripts/check-raw-storage-counts.sql`

- Track backfill progress
- Monitor storage usage
- View recent activity

## Recommended Execution Plan

### Phase 1: Published Items (Start Here)

```bash
# Test with 5 items first
curl -X POST http://localhost:3000/api/backfill-raw-storage \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"minStatus": 400, "maxStatus": 400, "limit": 5, "batchSize": 2, "delayMs": 3000}'

# If successful, backfill all 162 published items
curl -X POST http://localhost:3000/api/backfill-raw-storage \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"minStatus": 400, "maxStatus": 400, "limit": 162, "batchSize": 5, "delayMs": 2000}'
```

### Phase 2: Review Items

```bash
# Backfill 66 review items
curl -X POST http://localhost:3000/api/backfill-raw-storage \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"minStatus": 300, "maxStatus": 300, "limit": 66, "batchSize": 5, "delayMs": 2000}'
```

### Phase 3: Enrichment Items (Optional)

```bash
# Backfill 567 enrichment items (run during off-peak hours)
curl -X POST http://localhost:3000/api/backfill-raw-storage \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"minStatus": 200, "maxStatus": 299, "limit": 567, "batchSize": 10, "delayMs": 1000}'
```

## Storage Considerations

**Supabase Free Tier**: 1 GB storage

- Phase 1 (162 items): ~81 MB ✅ Safe
- Phase 1 + 2 (228 items): ~114 MB ✅ Safe
- All 3 phases (795 items): ~398 MB ✅ Safe

You have plenty of room in the free tier for all 795 items.

## Next Steps

1. **Start agent-api**: Make sure the agent-api is running
2. **Test**: Run Phase 1 with 5 items to verify it works
3. **Execute**: Backfill published items (162)
4. **Monitor**: Check `scripts/check-raw-storage-counts.sql`
5. **Continue**: Backfill review items (66)
6. **Optional**: Backfill enrichment items (567) if needed

## Files Created

- ✅ `services/agent-api/src/routes/backfill-raw-storage.js` - Backfill endpoint
- ✅ `services/agent-api/src/index.js` - Registered route
- ✅ `scripts/investigate-raw-storage.sql` - Investigation queries
- ✅ `scripts/check-raw-storage-counts.sql` - Monitoring queries
- ✅ `scripts/backfill-raw-storage-query.sql` - Identify items to backfill
- ✅ `docs/raw-storage-backfill-plan.md` - Detailed strategy
- ✅ `docs/raw-storage-backfill-summary.md` - This file
