# Declarative Pipeline Design

**Status:** Design (Phase 5)  
**Author:** AI Assistant  
**Date:** 2026-01-13  
**ASMM Phase:** 5 (Governance & Trust)

## Overview

This document describes a declarative, database-driven pipeline system for the enrichment workflow. The goal is to replace hardcoded orchestration logic with configurable pipelines stored in Supabase.

### Current State (Hardcoded)

```javascript
// orchestrator.js - fixed sequence, no configuration
const summarized = await runSummarizeStep(...);
const tagged = await runTagStep(summarized, ...);
const thumbResult = await runThumbnailStep(tagged, ...);
```

### Target State (Declarative)

```javascript
// orchestrator.js - reads pipeline from DB
const pipeline = await loadPipeline(context);
for (const step of pipeline.steps) {
  if (shouldSkip(step, payload)) continue;
  payload = await executeStep(step, payload);
}
await transition(pipeline.getExitStatus(context));
```

---

## Design Principles

1. **Single Source of Truth** - Pipeline definitions live in the database
2. **Context-Aware** - Entry status determines which pipeline and exit transition
3. **Auditable** - All pipeline executions are logged with full lineage
4. **Extensible** - New steps can be added without code changes
5. **Fail-Safe** - Invalid configurations are caught at load time, not runtime

---

## Database Schema

### Core Tables

```sql
-- ============================================================
-- PIPELINE DEFINITIONS
-- ============================================================

-- A pipeline is a named sequence of steps with entry/exit rules
CREATE TABLE pipeline_definition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE pipeline_definition IS
  'Defines named pipelines (e.g., full_enrichment, re_enrichment)';

-- ============================================================
-- PIPELINE STEPS
-- ============================================================

-- Steps within a pipeline, executed in order
CREATE TABLE pipeline_step (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES pipeline_definition(id) ON DELETE CASCADE,
  step_name text NOT NULL,           -- matches agent name: 'summarize', 'tag', 'thumbnail'
  step_order int NOT NULL,           -- execution order (1, 2, 3...)
  is_required boolean DEFAULT true,  -- false = can be skipped on error
  timeout_seconds int DEFAULT 300,   -- step timeout

  -- Conditional execution
  skip_condition jsonb,              -- skip if condition matches payload

  -- Routing on completion
  on_success text DEFAULT 'next',    -- 'next' | 'exit' | 'goto:step_name'
  on_failure text DEFAULT 'abort',   -- 'abort' | 'skip' | 'retry:N' | 'goto:step_name'

  created_at timestamptz DEFAULT now(),

  UNIQUE(pipeline_id, step_order),
  UNIQUE(pipeline_id, step_name)
);

COMMENT ON TABLE pipeline_step IS
  'Individual steps within a pipeline, with conditional logic';

-- ============================================================
-- PIPELINE ENTRY RULES
-- ============================================================

-- Which pipeline to use based on entry context
CREATE TABLE pipeline_entry_rule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES pipeline_definition(id) ON DELETE CASCADE,

  -- Matching criteria (all must match)
  from_status_code int,              -- entry status (200, 300, 400)
  trigger_type text,                 -- 'discovery' | 'manual' | 're-enrich' | 'retry'

  -- Priority for rule matching (higher = checked first)
  priority int DEFAULT 0,

  is_active boolean DEFAULT true,

  UNIQUE(from_status_code, trigger_type)
);

COMMENT ON TABLE pipeline_entry_rule IS
  'Rules to select which pipeline based on entry context';

-- ============================================================
-- PIPELINE EXIT RULES
-- ============================================================

-- Where to transition after pipeline completes
CREATE TABLE pipeline_exit_rule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES pipeline_definition(id) ON DELETE CASCADE,

  -- Context for exit (which entry status did we come from?)
  from_status_code int,              -- entry status that triggered the pipeline

  -- Exit configuration
  exit_status_code int NOT NULL,     -- target status on success
  is_manual boolean DEFAULT false,   -- requires _manual_override in payload?

  -- Failure handling
  failure_status_code int,           -- target status on pipeline failure (null = use default)

  UNIQUE(pipeline_id, from_status_code)
);

COMMENT ON TABLE pipeline_exit_rule IS
  'Determines target status based on entry context';

-- ============================================================
-- STEP REGISTRY
-- ============================================================

-- Registry of available step implementations
CREATE TABLE step_registry (
  name text PRIMARY KEY,             -- 'summarize', 'tag', 'thumbnail', 'fetch', 'filter'
  agent_name text NOT NULL,          -- agent that implements this step
  description text,
  input_schema jsonb,                -- expected payload fields
  output_schema jsonb,               -- fields added to payload
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE step_registry IS
  'Registry of available step implementations and their contracts';
```

### Execution Tracking Tables

```sql
-- ============================================================
-- PIPELINE EXECUTION LOG
-- ============================================================

-- Logs each pipeline execution for auditability
CREATE TABLE pipeline_execution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid NOT NULL REFERENCES ingestion_queue(id),
  pipeline_id uuid NOT NULL REFERENCES pipeline_definition(id),
  pipeline_run_id uuid REFERENCES pipeline_run(id),

  -- Entry context
  entry_status_code int NOT NULL,
  trigger_type text NOT NULL,

  -- Execution state
  status text NOT NULL DEFAULT 'running',  -- 'running' | 'completed' | 'failed' | 'aborted'
  current_step text,

  -- Timing
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,

  -- Results
  exit_status_code int,
  error_message text,

  -- Full execution trace
  step_results jsonb DEFAULT '[]'::jsonb
);

COMMENT ON TABLE pipeline_execution IS
  'Audit log of pipeline executions with full trace';

-- Index for finding executions by queue item
CREATE INDEX idx_pipeline_execution_queue ON pipeline_execution(queue_id);
```

---

## Skip Condition Syntax

The `skip_condition` field uses a simple JSON-based expression language:

```jsonc
// Skip if payload.thumbnail_bucket exists
{ "field": "thumbnail_bucket", "op": "exists" }

// Skip if payload.is_pdf is true
{ "field": "is_pdf", "op": "eq", "value": true }

// Skip if payload.word_count < 100
{ "field": "word_count", "op": "lt", "value": 100 }

// Compound conditions (all must match)
{ "all": [
  { "field": "is_pdf", "op": "eq", "value": false },
  { "field": "thumbnail_bucket", "op": "not_exists" }
]}
```

### Supported Operators

| Operator     | Description                  |
| ------------ | ---------------------------- |
| `exists`     | Field exists and is not null |
| `not_exists` | Field is null or missing     |
| `eq`         | Equals value                 |
| `neq`        | Not equals value             |
| `gt`, `gte`  | Greater than (or equal)      |
| `lt`, `lte`  | Less than (or equal)         |
| `in`         | Value in array               |
| `contains`   | Array contains value         |

---

## Example Pipeline Configurations

### Full Enrichment Pipeline (new items)

```sql
-- Pipeline definition
INSERT INTO pipeline_definition (name, description) VALUES
  ('full_enrichment', 'Complete enrichment for newly discovered items');

-- Steps
INSERT INTO pipeline_step (pipeline_id, step_name, step_order, on_failure) VALUES
  ((SELECT id FROM pipeline_definition WHERE name = 'full_enrichment'), 'fetch', 1, 'retry:3'),
  ((SELECT id FROM pipeline_definition WHERE name = 'full_enrichment'), 'filter', 2, 'abort'),
  ((SELECT id FROM pipeline_definition WHERE name = 'full_enrichment'), 'summarize', 3, 'abort'),
  ((SELECT id FROM pipeline_definition WHERE name = 'full_enrichment'), 'tag', 4, 'abort'),
  ((SELECT id FROM pipeline_definition WHERE name = 'full_enrichment'), 'thumbnail', 5, 'skip');

-- Entry rule: triggered from pending_enrichment (200)
INSERT INTO pipeline_entry_rule (pipeline_id, from_status_code, trigger_type) VALUES
  ((SELECT id FROM pipeline_definition WHERE name = 'full_enrichment'), 200, 'discovery');

-- Exit rule: go to pending_review (300)
INSERT INTO pipeline_exit_rule (pipeline_id, from_status_code, exit_status_code) VALUES
  ((SELECT id FROM pipeline_definition WHERE name = 'full_enrichment'), 200, 300);
```

### Re-Enrichment Pipeline (published items)

```sql
-- Pipeline definition
INSERT INTO pipeline_definition (name, description) VALUES
  ('re_enrichment', 'Re-run enrichment on published/review items');

-- Steps (skip fetch/filter, just run enrichment agents)
INSERT INTO pipeline_step (pipeline_id, step_name, step_order, on_failure) VALUES
  ((SELECT id FROM pipeline_definition WHERE name = 're_enrichment'), 'summarize', 1, 'abort'),
  ((SELECT id FROM pipeline_definition WHERE name = 're_enrichment'), 'tag', 2, 'abort'),
  ((SELECT id FROM pipeline_definition WHERE name = 're_enrichment'), 'thumbnail', 3, 'skip');

-- Entry rules: from review (300) or published (400)
INSERT INTO pipeline_entry_rule (pipeline_id, from_status_code, trigger_type) VALUES
  ((SELECT id FROM pipeline_definition WHERE name = 're_enrichment'), 300, 're-enrich'),
  ((SELECT id FROM pipeline_definition WHERE name = 're_enrichment'), 400, 're-enrich');

-- Exit rules: always go to pending_review (300), manual override for 400
INSERT INTO pipeline_exit_rule (pipeline_id, from_status_code, exit_status_code, is_manual) VALUES
  ((SELECT id FROM pipeline_definition WHERE name = 're_enrichment'), 300, 300, false),
  ((SELECT id FROM pipeline_definition WHERE name = 're_enrichment'), 400, 300, true);
```

---

## Orchestrator Implementation

### Pipeline Loader

```javascript
// lib/pipeline-loader.js

export async function loadPipeline(context) {
  const { statusCode, triggerType } = context;

  // Find matching entry rule
  const { data: rule } = await supabase
    .from('pipeline_entry_rule')
    .select('pipeline_id')
    .eq('from_status_code', statusCode)
    .eq('trigger_type', triggerType)
    .eq('is_active', true)
    .order('priority', { ascending: false })
    .limit(1)
    .single();

  if (!rule) throw new Error(`No pipeline for status=${statusCode}, trigger=${triggerType}`);

  // Load pipeline with steps
  const { data: pipeline } = await supabase
    .from('pipeline_definition')
    .select(
      `
      *,
      steps:pipeline_step(*)
    `,
    )
    .eq('id', rule.pipeline_id)
    .single();

  // Load exit rule
  const { data: exitRule } = await supabase
    .from('pipeline_exit_rule')
    .select('*')
    .eq('pipeline_id', rule.pipeline_id)
    .eq('from_status_code', statusCode)
    .single();

  return { ...pipeline, exitRule };
}
```

### Step Executor

```javascript
// lib/step-executor.js

const STEP_HANDLERS = {
  fetch: runFetchStep,
  filter: runFilterStep,
  summarize: runSummarizeStep,
  tag: runTagStep,
  thumbnail: runThumbnailStep,
};

export async function executeStep(step, queueId, payload, pipelineRunId) {
  const handler = STEP_HANDLERS[step.step_name];
  if (!handler) throw new Error(`Unknown step: ${step.step_name}`);

  // Check skip condition
  if (step.skip_condition && evaluateCondition(step.skip_condition, payload)) {
    return { skipped: true, payload };
  }

  // Execute with timeout
  const result = await withTimeout(
    handler(queueId, payload, pipelineRunId),
    step.timeout_seconds * 1000,
  );

  return { skipped: false, payload: result };
}
```

### Pipeline Runner

```javascript
// lib/pipeline-runner.js

export async function runPipeline(queueItem, triggerType) {
  const context = {
    statusCode: queueItem.status_code,
    triggerType,
  };

  const pipeline = await loadPipeline(context);
  const execution = await createExecution(queueItem.id, pipeline, context);

  let payload = queueItem.payload;

  try {
    for (const step of pipeline.steps.sort((a, b) => a.step_order - b.step_order)) {
      await updateExecution(execution.id, { current_step: step.step_name });

      const result = await executeStep(step, queueItem.id, payload, execution.pipeline_run_id);

      await logStepResult(execution.id, step.step_name, result);

      if (!result.skipped) {
        payload = result.payload;
      }
    }

    // Success: transition to exit status
    await transitionByAgent(queueItem.id, pipeline.exitRule.exit_status_code, 'orchestrator', {
      changes: { payload },
      isManual: pipeline.exitRule.is_manual,
    });

    await completeExecution(execution.id, 'completed', pipeline.exitRule.exit_status_code);
  } catch (error) {
    await completeExecution(execution.id, 'failed', null, error.message);
    throw error;
  }
}
```

---

## Migration Path

### Phase 1: Schema Only (Current PR)

- Create tables with seed data matching current hardcoded logic
- No runtime changes yet

### Phase 2: Read Pipeline, Ignore

- Orchestrator loads pipeline config
- Logs comparison: "would have done X" vs "actually did Y"
- Validates config matches hardcoded behavior

### Phase 3: Feature Flag

- Add `USE_DECLARATIVE_PIPELINE` env var
- When enabled, use declarative runner
- Easy rollback if issues

### Phase 4: Full Cutover

- Remove hardcoded logic
- All pipelines driven by DB config
- Admin UI for pipeline management

---

## Admin UI (Future)

A pipeline management UI would allow:

1. **View pipelines** - List all defined pipelines with step counts
2. **Edit steps** - Drag-and-drop step reordering
3. **Configure conditions** - Visual builder for skip conditions
4. **Test pipeline** - Dry-run with sample payload
5. **View executions** - Audit log with step-by-step trace

---

## Benefits

| Benefit               | Description                              |
| --------------------- | ---------------------------------------- |
| **Configurability**   | Add/remove/reorder steps without deploys |
| **Auditability**      | Full execution trace in DB               |
| **Context-Awareness** | Different behavior for re-enrich vs new  |
| **Testability**       | Validate config before runtime           |
| **Governance**        | Approval workflow for pipeline changes   |

---

## Open Questions

1. **Versioning** - Should pipeline changes create new versions?
2. **Rollback** - How to revert a pipeline change quickly?
3. **A/B Testing** - Route % of traffic to experimental pipeline?
4. **Step Dependencies** - Allow parallel execution of independent steps?

---

## References

- [ASMM Phase 5: Governance & Trust](./agentic-systems-maturity-model.md)
- [Orchestration Design](./orchestration-design.md)
- [Pipeline Status Codes](./pipeline-status-codes.md)
