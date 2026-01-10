# Backlog: PII Detection and Redaction

## Summary

Implement PII (Personally Identifiable Information) detection and optional redaction for content sent to LLM providers.

## Status

**Not Started** - Tracked for Phase 1+

## Context

Currently, raw content from public web sources is sent to LLM providers without PII scanning. This is acceptable for Phase 0 because:

- Content comes from public news/research sources
- No user-generated content flows through the pipeline
- LLM providers (OpenAI, Anthropic) have enterprise data handling policies

However, as the system matures, PII handling should be improved.

## Requirements

### Must Have (P1)

1. **Detection**: Identify common PII patterns in content before sending to LLM
   - Email addresses
   - Phone numbers
   - Social Security Numbers (US)
   - Credit card numbers

2. **Logging**: Log when PII is detected
   - Log pattern type and count (not the actual PII)
   - Example: `⚠️ PII detected: 2 emails, 1 phone number (not redacted)`

3. **Metrics**: Track PII detection rates
   - Store in `agent_run_metric` table
   - Enable monitoring for unexpected PII in content

### Should Have (P2)

4. **Redaction Mode**: Optional redaction before sending to LLM
   - Replace detected PII with placeholders: `[EMAIL]`, `[PHONE]`, etc.
   - Configurable per agent via prompt_version config

5. **Allowlist**: Skip redaction for expected entities
   - Author names (expected in articles)
   - Company names (expected in business content)

### Could Have (P3)

6. **Advanced Detection**: Use ML-based NER for entity detection
   - Person names
   - Addresses
   - Organization-specific sensitive data

## Technical Approach

### Option A: Regex-based Detection (Recommended for P1)

```javascript
const PII_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
  ssn: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g,
  creditCard: /\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b/g,
};

function detectPII(content) {
  const detected = {};
  for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
    const matches = content.match(pattern);
    if (matches?.length) {
      detected[type] = matches.length;
    }
  }
  return detected;
}
```

### Option B: Library-based Detection

Use a library like `pii-redactor` or `compromise` for more robust detection.

## Files to Modify

- `services/agent-api/src/lib/llm.js` - Add PII check before API calls
- `services/agent-api/src/lib/pii-detection.js` - New module for detection logic
- `services/agent-api/src/lib/runner.js` - Add PII metrics logging

## Acceptance Criteria

- [ ] PII patterns are detected before content is sent to LLM
- [ ] Detection results are logged (counts only, not actual PII)
- [ ] Metrics are stored in `agent_run_metric` for monitoring
- [ ] Documentation updated with PII handling status
- [ ] Optional redaction mode can be enabled per agent

## References

- US 9.2: Sensitive Data Handling in Prompts
- `docs/architecture/prompt-sensitive-data-policy.md`
