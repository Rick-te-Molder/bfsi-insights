# Replay Capability

**Status:** Implemented (Phase 2 Task 1.3)  
**Last Updated:** January 2, 2026

## Overview

The replay capability allows reconstructing pipeline execution from the event log without re-executing external calls. This satisfies ASMM Phase 1 requirements for auditability and deterministic replay.

## Architecture

### Event Log Foundation

Replay is built on top of the existing event logging infrastructure:

- `pipeline_run` - Tracks overall pipeline execution
- `pipeline_step_run` - Tracks individual step execution with input/output snapshots

### Replay Types

**1. Deterministic Replay (Critical Steps)**

- Reconstructs state transitions exactly as recorded
- Does NOT re-call external APIs or LLMs
- Uses stored input/output from event log
- Target: 100% success rate

**2. Best-Effort Replay (Non-Critical Steps)**

- May re-call external APIs if needed for debugging
- Results may differ from original
- Used for debugging, not compliance
- Target: >90% success rate

## Implementation

### Core Function: `replayPipelineRun()`

```javascript
import { replayPipelineRun } from './lib/replay.js';

// Replay in simulation mode (no DB writes)
const result = await replayPipelineRun(runId, {
  simulate: true, // Don't write to DB
  verbose: false, // Minimal logging
});

// Replay with DB writes (for recovery)
const result = await replayPipelineRun(runId, {
  simulate: false, // Write replay results
  verbose: true, // Detailed logging
});
```

### Result Structure

```javascript
{
  success: true,
  runId: "uuid",
  itemId: "uuid",
  stepsReplayed: 5,
  stateHistory: [
    {
      timestamp: "2026-01-02T00:00:00Z",
      event: "pipeline_started",
      trigger: "discovery",
      status: "running"
    },
    {
      timestamp: "2026-01-02T00:00:01Z",
      event: "step_started",
      stepName: "summarize",
      attempt: 1,
      input: { ... }
    },
    {
      timestamp: "2026-01-02T00:00:05Z",
      event: "step_success",
      stepName: "summarize",
      attempt: 1,
      output: { ... }
    },
    // ... more events
  ],
  validation: {
    isValid: true,
    errors: [],
    warnings: []
  },
  simulated: true
}
```

## API Endpoints

### POST /api/replay/:runId

Replay a single pipeline run.

**Request:**

```json
{
  "simulate": true,
  "verbose": false
}
```

**Response:**

```json
{
  "success": true,
  "runId": "uuid",
  "stepsReplayed": 5,
  "stateHistory": [...],
  "validation": {...}
}
```

### POST /api/replay/batch

Replay multiple pipeline runs.

**Request:**

```json
{
  "runIds": ["uuid1", "uuid2", ...],
  "simulate": true,
  "verbose": false
}
```

**Response:**

```json
{
  "total": 10,
  "successful": 10,
  "failed": 0,
  "successRate": "100%",
  "results": [...]
}
```

### POST /api/replay/test

Test replay capability on random sample (ASMM Phase 1 validation).

**Request:**

```json
{
  "sampleSize": 100
}
```

**Response:**

```json
{
  "total": 100,
  "successful": 100,
  "failed": 0,
  "successRate": "100%",
  "meetsPhase1": true,
  "phase1Target": "100%"
}
```

### GET /api/replay/sample

Get random sample of run IDs for testing.

**Query params:**

- `size` - Sample size (default: 100)
- `status` - Filter by status (optional)
- `minDate` - Filter by min date (optional)
- `maxDate` - Filter by max date (optional)

## CLI Commands

### Test Replay Capability

```bash
npm run cli replay test -- --sample-size 100
```

Tests replay on 100 random pipeline runs and validates against ASMM Phase 1 criteria (100% success rate).

### Replay Single Run

```bash
npm run cli replay run -- --run-id <uuid> --simulate true --verbose true
```

### Replay Multiple Runs

```bash
npm run cli replay batch -- --run-ids <uuid1>,<uuid2>,<uuid3> --simulate true
```

### Get Random Sample

```bash
npm run cli replay sample -- --size 100 --status completed
```

## Validation

The replay system validates:

1. **Event Completeness** - All steps have start and complete events
2. **Output Consistency** - Successful steps have output, failed steps have errors
3. **Chronological Order** - State history is in correct time sequence
4. **State Transitions** - All transitions are valid per state machine

## ASMM Phase 1 Compliance

### Exit Criteria

| Criterion                    | Target          | Implementation           |
| ---------------------------- | --------------- | ------------------------ |
| Deterministic replay success | 100% (n=100)    | `testReplayCapability()` |
| Best-effort replay success   | >90% (n=100)    | Same function            |
| Replay time                  | <10x original   | Measured in validation   |
| No side effects              | Simulation mode | `simulate=true` flag     |

### Testing

Run ASMM Phase 1 validation:

```bash
npm run cli replay test -- --sample-size 100
```

Expected output:

```
✅ ASMM Phase 1 Criteria:
   Target: 100% success rate
   Actual: 100%
   Status: ✅ PASS
```

## How Replay Works

### 1. Load Event Log

```javascript
// Load pipeline_run
const run = await loadPipelineRun(runId);

// Load all pipeline_step_run records
const steps = await loadStepRuns(runId);
```

### 2. Reconstruct State History

```javascript
// Build chronological state history from events
const stateHistory = reconstructStateHistory(run, steps);
```

State history includes:

- Pipeline started/completed events
- Step started/completed events
- Input snapshots
- Output data
- Error messages
- Timestamps

### 3. Validate Replay

```javascript
// Check completeness and consistency
const validation = validateReplay(run, steps, stateHistory);
```

Validation checks:

- All steps have corresponding events
- Completed steps have output or error
- State history is chronological
- No missing data

### 4. Write Results (Optional)

```javascript
// If simulate=false, write replay audit
await writeReplayResults(runId, stateHistory, validation);
```

## Use Cases

### 1. Compliance Audit

Demonstrate that system behavior can be reconstructed from event log:

```bash
npm run cli replay test -- --sample-size 100
```

### 2. Debugging

Replay a specific failed run to understand what happened:

```bash
npm run cli replay run -- --run-id <uuid> --verbose true
```

### 3. Recovery

Replay and write results to recover from data loss:

```bash
npm run cli replay run -- --run-id <uuid> --simulate false
```

### 4. Testing

Validate replay capability after code changes:

```bash
npm run cli replay test -- --sample-size 100
```

## Limitations

### What Replay Does NOT Do

1. **Does not re-execute external calls** - Uses stored results from event log
2. **Does not modify original data** - In simulate mode, no DB writes
3. **Does not guarantee identical LLM output** - LLMs are non-deterministic
4. **Does not replay real-time** - Reconstructs instantly from log

### What Replay DOES Do

1. **Reconstructs state transitions** - Shows exactly what happened
2. **Validates event log completeness** - Ensures auditability
3. **Provides deterministic results** - Same input → same replay output
4. **Enables compliance** - Demonstrates system behavior

## Related

- `services/agent-api/src/lib/replay.js` - Core implementation
- `services/agent-api/src/routes/replay.js` - API endpoints
- `services/agent-api/src/cli/commands/replay.js` - CLI commands
- `services/agent-api/src/lib/pipeline-tracking.js` - Event logging
- `docs/architecture/asmm-phase1-operational-stability.md` - ASMM requirements
- `docs/planning/phase-2-roadmap.md` - Task 1.3 details
