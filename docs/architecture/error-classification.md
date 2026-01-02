# Error Classification & Dead-Letter Queue

**Status:** Implemented (Phase 2 Task 1.4)  
**Last Updated:** January 2, 2026

## Overview

The error classification system automatically categorizes errors as retryable or terminal and implements exponential backoff with jitter for retry logic. This satisfies ASMM Phase 1 requirements for failure classification.

## Error Types

### Retryable Errors

Errors that may succeed on retry:

- **Server errors (5xx)** - Temporary server issues
- **Timeout errors** - Network timeouts, connection resets
- **Network errors** - Connection refused, DNS failures
- **Rate limit errors (429)** - Too many requests

### Terminal Errors

Errors that will not succeed on retry:

- **Client errors (4xx except 429)** - Bad request, not found, etc.
- **Authentication errors** - Unauthorized, forbidden
- **Validation errors** - Invalid input, malformed data

## Backoff Strategy

### Configuration

```javascript
const BackoffConfig = {
  base: 1000, // 1 second
  max: 60000, // 60 seconds
  jitter: 0.2, // ±20%
  multiplier: 2, // Double each time
  rateLimitBase: 10000, // 10 seconds for rate limits
};
```

### Exponential Backoff Formula

```
delay = min(base * multiplier^(attempt-1), max) ± jitter
```

### Examples

| Attempt | Standard Error       | Rate Limit (429)   |
| ------- | -------------------- | ------------------ |
| 1       | 1s ± 0.2s            | 10s ± 2s           |
| 2       | 2s ± 0.4s            | 20s ± 4s           |
| 3       | 4s ± 0.8s            | 40s ± 8s           |
| 4       | 8s ± 1.6s            | 60s ± 12s (capped) |
| 5+      | 16s+ (capped at 60s) | 60s ± 12s (capped) |

## Dead-Letter Queue (DLQ)

### When Items Move to DLQ

1. **Terminal errors** - Immediately on first failure
2. **Retryable errors** - After 3 failures on the same step

### DLQ Status Code

Items in DLQ have status code `599` (dead_letter).

### DLQ Fields

The `ingestion_queue` table tracks:

- `failure_count` - Number of consecutive failures
- `last_failed_step` - Which step failed
- `last_error_message` - Error message (truncated to 1000 chars)
- `last_error_signature` - Normalized error for grouping
- `last_error_at` - Timestamp of last error
- `error_type` - Classification (retryable/terminal/rate_limit)
- `error_retryable` - Boolean flag
- `retry_after` - Timestamp when retry should be attempted

## Implementation

### Error Classification

```javascript
import { classifyError } from './lib/error-classification.js';

try {
  // ... agent logic
} catch (error) {
  const classification = classifyError(error);

  console.log(`Error type: ${classification.type}`);
  console.log(`Retryable: ${classification.retryable}`);
  console.log(`Reason: ${classification.reason}`);
}
```

### Retry Delay Calculation

```javascript
import { getRetryDelay } from './lib/error-classification.js';

const attemptNumber = 3;
const delay = getRetryDelay(attemptNumber, error);

if (delay) {
  console.log(`Retry in ${delay}ms`);
  await new Promise((resolve) => setTimeout(resolve, delay));
}
```

### DLQ Decision

```javascript
import { shouldMoveToDLQ, classifyError } from './lib/error-classification.js';

const classification = classifyError(error);
const failureCount = 3;

if (shouldMoveToDLQ(failureCount, classification)) {
  // Move to DLQ (status 599)
  console.log('Moving to dead-letter queue');
} else {
  // Retry with backoff
  const delay = getRetryDelay(failureCount, error);
  console.log(`Retrying in ${delay}ms`);
}
```

### Integrated Failure Handling

```javascript
import { handleItemFailure } from './lib/pipeline-tracking.js';

try {
  // ... agent logic
} catch (error) {
  await handleItemFailure(item, 'agent-name', 'step-name', error, config);
}
```

The `handleItemFailure` function automatically:

1. Classifies the error
2. Calculates retry delay with exponential backoff
3. Determines if item should move to DLQ
4. Updates item status and metadata
5. Logs appropriate messages

## Error Classification Rules

### Rate Limit (429)

**Triggers:**

- HTTP status code 429
- Message contains "rate limit"
- Message contains "too many requests"

**Behavior:**

- Retryable: Yes
- Base delay: 10 seconds (longer than standard)
- Exponential backoff with jitter

### Server Errors (5xx)

**Triggers:**

- HTTP status code 500-599

**Behavior:**

- Retryable: Yes
- Base delay: 1 second
- Exponential backoff with jitter

### Timeout Errors

**Triggers:**

- Message contains "timeout"
- Message contains "ETIMEDOUT"
- Message contains "ECONNRESET"

**Behavior:**

- Retryable: Yes
- Base delay: 1 second
- Exponential backoff with jitter

### Network Errors

**Triggers:**

- Message contains "ECONNREFUSED"
- Message contains "ENOTFOUND"
- Message contains "network"

**Behavior:**

- Retryable: Yes
- Base delay: 1 second
- Exponential backoff with jitter

### Client Errors (4xx)

**Triggers:**

- HTTP status code 400-499 (except 429)

**Behavior:**

- Retryable: No
- Moves to DLQ immediately

### Authentication Errors

**Triggers:**

- Message contains "unauthorized"
- Message contains "forbidden"
- Message contains "authentication"

**Behavior:**

- Retryable: No
- Moves to DLQ immediately

### Validation Errors

**Triggers:**

- Message contains "validation"
- Message contains "invalid"
- Message contains "malformed"

**Behavior:**

- Retryable: No
- Moves to DLQ immediately

### Unknown Errors

**Default behavior:**

- Retryable: Yes (conservative approach)
- Base delay: 1 second
- Exponential backoff with jitter

## ASMM Phase 1 Compliance

### Exit Criteria

| Criterion                 | Target                    | Implementation                |
| ------------------------- | ------------------------- | ----------------------------- |
| Error classification      | All errors classified     | `classifyError()`             |
| Retryable errors          | Exponential backoff       | `calculateBackoff()`          |
| Rate limit errors (429)   | Longer backoff (10s base) | `BackoffConfig.rateLimitBase` |
| Server errors (5xx)       | Standard backoff          | `BackoffConfig.base`          |
| Terminal errors           | DLQ immediately           | `shouldMoveToDLQ()`           |
| Failure misclassification | <5%                       | Manual audit required         |

### Testing

To validate error classification:

```javascript
// Test various error types
const errors = [
  { statusCode: 429, message: 'Rate limit exceeded' },
  { statusCode: 500, message: 'Internal server error' },
  { statusCode: 404, message: 'Not found' },
  { message: 'ETIMEDOUT' },
  { message: 'Invalid input' },
];

errors.forEach((error) => {
  const classification = classifyError(error);
  console.log(`${error.message}: ${classification.type} (retryable: ${classification.retryable})`);
});
```

## Monitoring

### DLQ Metrics

Track these metrics to monitor DLQ health:

- **DLQ size** - Number of items in status 599
- **DLQ inflow rate** - Items moving to DLQ per hour
- **Terminal error rate** - % of errors that are terminal
- **Retry success rate** - % of retries that succeed

### Error Signatures

Errors are normalized into signatures for grouping:

- UUIDs replaced with "UUID"
- Numbers replaced with "N"
- Truncated to 100 characters

This allows identifying common error patterns.

## Related

- `services/agent-api/src/lib/error-classification.js` - Core implementation
- `services/agent-api/src/lib/pipeline-tracking.js` - Integration with failure handling
- `docs/architecture/asmm-phase1-operational-stability.md` - ASMM requirements
- `docs/planning/phase-2-roadmap.md` - Task 1.4 details
