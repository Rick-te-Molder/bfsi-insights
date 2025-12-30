# Agent Orchestration Audit

**Date:** 2025-12-22  
**Issue:** Agents violating orchestration boundaries

## Architecture Principle

**ONLY the orchestrator should:**

- Start agent runs
- Update `ingestion_queue.status_code`
- Control the pipeline flow

**Individual agents (summarizer, tagger, thumbnailer, screener) should:**

- Receive input
- Process data
- Return results
- NOT update queue status
- NOT start other agents

## Violations Found

### 1. Thumbnailer - Direct Status Update

**File:** `services/agent-api/src/agents/thumbnailer.js:154-160`

```javascript
await supabase
  .from('ingestion_queue')
  .update({
    status_code: 540,
    rejection_reason: `Invalid URL scheme: only http/https supported (got: ${targetUrl.substring(0, 50)})`,
  })
  .eq('id', queueId);
```

**Violation:** Thumbnailer directly updates status_code to 540 (rejected) when URL has invalid scheme.

**Impact:**

- Bypasses orchestrator control
- No agent_run record created
- Status changes not tracked properly
- Breaks orchestration flow

**Fix Required:**

- Thumbnailer should throw an error
- Orchestrator catches error and updates status
- Maintains single point of control

### 2. Other Agents - Status Check

**Summarizer:** ✅ No direct status updates found  
**Tagger:** ✅ No direct status updates found  
**Screener:** ✅ No direct status updates found

## Current Flow (Correct)

```
orchestrator.js
  ├─> stepFetch() → updateStatus(TO_SUMMARIZE)
  ├─> stepFilter() → updateStatus(TO_SUMMARIZE or IRRELEVANT)
  ├─> stepSummarize() → runSummarizer() → updateStatus(TO_TAG)
  ├─> stepTag() → runTagger() → updateStatus(THUMBNAILING or PENDING_REVIEW)
  └─> stepThumbnail() → runThumbnailer() → updateStatus(PENDING_REVIEW)
```

## Violation Flow (Incorrect)

```
orchestrator.js
  └─> stepThumbnail() → runThumbnailer()
        └─> [VIOLATION] thumbnailer updates status_code directly
```

## Recommended Fix

### Before (Thumbnailer)

```javascript
// WRONG: Agent updates status directly
await supabase
  .from('ingestion_queue')
  .update({ status_code: 540, rejection_reason: '...' })
  .eq('id', queueId);
return { rejected: true };
```

### After (Thumbnailer)

```javascript
// CORRECT: Agent throws error, orchestrator handles it
throw new Error(
  `Invalid URL scheme: only http/https supported (got: ${targetUrl.substring(0, 50)})`,
);
```

### Orchestrator Handles Error

```javascript
async function stepThumbnail(queueId, payload) {
  await updateStatus(queueId, STATUS.THUMBNAILING);
  console.log('   📸 Generating thumbnail...');
  try {
    const result = await runThumbnailer({ id: queueId, payload });
    return {
      ...payload,
      thumbnail_bucket: result.bucket,
      thumbnail_path: result.path,
      thumbnail_url: result.publicUrl,
    };
  } catch (error) {
    // Check if error is fatal (invalid URL scheme)
    if (error.message.includes('Invalid URL scheme')) {
      console.log(`   ❌ Fatal error: ${error.message}`);
      await updateStatus(queueId, STATUS.REJECTED, {
        rejection_reason: error.message,
      });
      throw error; // Re-throw to stop enrichment
    }

    // Non-fatal errors: log and continue
    console.log(`   ⚠️ Thumbnail failed: ${error.message} (continuing without)`);
    return payload;
  }
}
```

## Benefits of Fix

1. **Single Point of Control:** Only orchestrator updates status
2. **Proper Error Handling:** Orchestrator decides how to handle errors
3. **Agent Run Tracking:** All status changes tracked in agent_run table
4. **Testability:** Agents are pure functions (input → output)
5. **Maintainability:** Clear separation of concerns

## Action Items

- [ ] Fix thumbnailer to throw errors instead of updating status
- [ ] Update orchestrator to handle thumbnailer errors appropriately
- [ ] Audit all agents for similar violations
- [ ] Add linting rule to prevent direct status updates in agents
- [ ] Update agent development guidelines

## Related Files

- `services/agent-api/src/agents/orchestrator.js` - Orchestrator
- `services/agent-api/src/agents/thumbnailer.js` - Violation found
- `services/agent-api/src/agents/summarizer.js` - Clean
- `services/agent-api/src/agents/tagger.js` - Clean
- `services/agent-api/src/agents/screener.js` - Clean
