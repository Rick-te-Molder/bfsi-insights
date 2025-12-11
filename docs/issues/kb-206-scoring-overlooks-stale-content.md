# KB-206: Scoring Overlooks Stale Content

## Problem Statement

The review queue contains an article from **May 29, 1996** (29 years old) with:

- Thumbnail clearly showing **"INACTIVE"** banner
- Page text stating: _"This page is no longer active. Its content has expired or been rescinded by the FDIC."_
- Article's own summary mentions: _"Written comments due June 24, 1996"_

This wastes reviewer time and reduces trust in the curation pipeline.

---

## Current Scoring Behavior

### How Discovery Works

1. **RSS/Feed Crawling**: `discover.js` fetches URLs from configured sources
2. **Relevance Scoring**: `discovery-relevance.js` scores content 1-10 using GPT-4o-mini
3. **Threshold**: Items scoring ≥4 are queued; <4 are auto-skipped

### Why This Article Passed

**Root Cause: Trusted Source Bypass**

```javascript
// discovery-relevance.js lines 56-83
const TRUSTED_SOURCES = new Set([
  'fdic', // <-- FDIC is in the trusted list
  // ... other regulators, central banks, consultants
]);

// Lines 142-152
if (isTrustedSource(source)) {
  return {
    relevance_score: 8, // Auto-pass without LLM
    executive_summary: `Trusted source: ${source}`,
    should_queue: true,
    trusted_source: true,
  };
}
```

**FDIC content auto-passes with score 8** - no LLM analysis, no date check, no staleness detection.

### What Scoring Does NOT Consider

| Factor                     | Current State          | Risk                                    |
| -------------------------- | ---------------------- | --------------------------------------- |
| **Publication date**       | ❌ Not checked         | Decades-old content passes              |
| **Staleness keywords**     | ❌ Not checked         | "INACTIVE", "rescinded", "expired" pass |
| **Page content validity**  | ❌ Not analyzed        | Tombstone pages pass                    |
| **Trusted source content** | ❌ Bypasses all checks | Any URL from FDIC.gov passes            |

---

## Proposed Improvements

### Option A: Add Date Filtering (Quick Win)

Add maximum age filter during discovery:

```javascript
const MAX_CONTENT_AGE_DAYS = 365 * 2; // 2 years

function isContentTooOld(publishedDate) {
  if (!publishedDate) return false; // Don't filter if unknown
  const ageMs = Date.now() - new Date(publishedDate).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return ageDays > MAX_CONTENT_AGE_DAYS;
}
```

**Pros**: Simple, fast, no LLM cost
**Cons**: Misses timeless content; requires reliable date parsing

### Option B: Staleness Keywords Filter (Quick Win)

Add blocklist for stale content indicators:

```javascript
const STALENESS_INDICATORS = [
  'inactive',
  'rescinded',
  'expired',
  'superseded',
  'archived',
  'no longer active',
  'this page has been removed',
];

function hasStaleIndicators(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  return STALENESS_INDICATORS.some((term) => text.includes(term));
}
```

**Pros**: Catches tombstone pages immediately
**Cons**: May miss some; needs to fetch page content

### Option C: Remove Trusted Source Bypass (Medium Effort)

Send ALL content through LLM scoring, including trusted sources:

```javascript
// Remove the early return for trusted sources
// Let LLM evaluate even FDIC content
```

**Pros**: Catches all quality issues
**Cons**: Higher LLM costs (~$0.003/call × volume from regulators)

### Option D: Add Post-Fetch Validation (Recommended)

After fetching the page content for enrichment, add validation:

```javascript
// In summarization agent, check page for staleness
const STALENESS_PATTERNS = [
  /\binactive\b/i,
  /\brescinded\b/i,
  /\bexpired\b/i,
  /\bno longer (active|valid|current)\b/i,
  /\bthis (page|document) (has been|is) (removed|archived)\b/i,
];

function detectStalePage(pageContent) {
  return STALENESS_PATTERNS.some((pattern) => pattern.test(pageContent));
}
```

**Pros**: Uses actual page content, catches "INACTIVE" banners
**Cons**: Detection happens later in pipeline (after fetch)

---

## Acceptance Criteria

1. [ ] Articles older than 2 years are flagged for extra scrutiny
2. [ ] Content containing "INACTIVE", "rescinded", "expired" is auto-rejected or flagged
3. [ ] Trusted sources still get LLM scoring for content quality (not just source trust)
4. [ ] Tombstone/placeholder pages are detected and rejected
5. [ ] Existing queue items from 1996 can be bulk-rejected

---

## Technical Notes

### Files to Modify

| File                                                   | Change                                    |
| ------------------------------------------------------ | ----------------------------------------- |
| `services/agent-api/src/agents/discovery-relevance.js` | Add date/staleness checks                 |
| `services/agent-api/src/agents/discover.js`            | Pass publication date to scoring          |
| `services/agent-api/src/agents/summarize.js`           | Add post-fetch staleness detection        |
| `supabase/`                                            | Migration to add `is_stale` flag to queue |

### Questions to Resolve

1. **What's the acceptable content age?** 2 years? 5 years? Configurable per source?
2. **Should we completely remove trusted source bypass?** Or just add date checks?
3. **How to handle legitimately old but relevant content?** (e.g., Basel II framework from 2004)
4. **Bulk cleanup**: How many items in current queue are stale?

---

## References

- Affected item: `https://www.fdic.gov/news/inactive-financial-institution-letters/1996/fil9632.html`
- Discovery agent: `services/agent-api/src/agents/discover.js`
- Relevance scoring: `services/agent-api/src/agents/discovery-relevance.js`
