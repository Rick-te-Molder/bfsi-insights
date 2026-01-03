# Pipeline State Machine

**Status:** Implemented (Phase 2 Task 1.1)  
**Last Updated:** December 31, 2024

## Overview

The pipeline state machine enforces valid state transitions for items moving through the ingestion and enrichment pipeline. All transitions are stored in the database (`state_transitions` table) and validated both at the database level (triggers) and application level (JavaScript).

## Architecture

### Database-Driven Design

State transitions are **not hardcoded** in the application. Instead, they are:

1. **Stored in `state_transitions` table** - Single source of truth
2. **Validated by database trigger** - Prevents invalid updates at DB level
3. **Cached in application** - Loaded once at startup for performance
4. **Reloadable** - Can be updated without code deployment

### Benefits

- **Maintainability:** Add/remove transitions via SQL migration, no code changes
- **Auditability:** All valid transitions documented in database
- **Consistency:** Database trigger ensures no invalid transitions slip through
- **Flexibility:** Manual override transitions clearly marked with `is_manual` flag

## State Transition Types

### Normal Transitions (is_manual = false)

Automatic transitions that happen during normal pipeline flow:

```
discovered → to_fetch → fetching → fetched → pending_enrichment
  → to_summarize → summarizing → summarized
  → to_tag → tagging → tagged
  → to_thumbnail → thumbnailing → thumbnailed
  → enriched → pending_review → published
```

### Manual Transitions (is_manual = true)

Require explicit override flag, used for re-enrichment:

```
pending_review → to_summarize (re-enrich)
pending_review → to_tag (re-enrich)
published → to_summarize (re-enrich)
published → pending_review (back to review)
```

### Failure Transitions

Working states can transition to `failed` (500):

```
fetching → failed
summarizing → failed
tagging → failed
thumbnailing → failed
```

### Rejection Transitions

Items can be rejected at various stages:

```
summarizing → rejected (bad data)
tagging → rejected (bad data)
pending_review → rejected (curator decision)
```

## Database Schema

### state_transitions Table

```sql
CREATE TABLE public.state_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_status smallint NOT NULL REFERENCES public.status_lookup(code),
  to_status smallint NOT NULL REFERENCES public.status_lookup(code),
  is_manual boolean DEFAULT false,
  description text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(from_status, to_status, is_manual)
);
```

### Validation Function

```sql
CREATE OR REPLACE FUNCTION public.validate_state_transition(
  p_from_status smallint,
  p_to_status smallint,
  p_is_manual boolean DEFAULT false
)
RETURNS boolean
```

Checks if transition exists in `state_transitions` table.

### Enforcement Trigger

```sql
CREATE TRIGGER enforce_state_transition_trigger
  BEFORE UPDATE OF status_code ON public.ingestion_queue
  FOR EACH ROW
  WHEN (OLD.status_code IS DISTINCT FROM NEW.status_code)
  EXECUTE FUNCTION public.enforce_state_transition();
```

Prevents invalid transitions at database level.

## Application Usage

### Initialization

```javascript
import { initStateMachine } from './lib/state-machine.js';

// Load status codes and state transitions from database
await initStateMachine();
```

### Validating Transitions

```javascript
import { validateTransition } from './lib/state-machine.js';

// Validate before updating status
try {
  validateTransition(currentStatus, nextStatus);
  // Proceed with update
} catch (err) {
  console.error('Invalid transition:', err.message);
  // Handle error
}
```

### Manual Overrides

```javascript
// For re-enrichment or other manual operations
validateTransition(currentStatus, nextStatus, { isManual: true });

// In database update, set _manual_override flag
await supabase
  .from('ingestion_queue')
  .update({
    status_code: nextStatus,
    payload: { ...payload, _manual_override: true },
  })
  .eq('id', itemId);
```

### Getting Valid Next States

```javascript
import { getValidNextStates } from './lib/state-machine.js';

// Get normal transitions only
const normalStates = getValidNextStates(currentStatus);

// Include manual transitions
const allStates = getValidNextStates(currentStatus, true);
```

## Adding New Transitions

To add a new valid transition:

1. **Create migration:**

```sql
-- infra/supabase/migrations/YYYYMMDD_add_new_transition.sql
INSERT INTO public.state_transitions (from_status, to_status, is_manual, description)
VALUES (300, 240, true, 'pending_review → enriched (skip re-enrichment)');
```

2. **Apply migration:**

```bash
supabase db push
```

3. **Reload in application (optional):**

```javascript
import { reloadStateMachine } from './lib/state-machine.js';
await reloadStateMachine();
```

Or restart the application to reload automatically.

## Working States

States where an agent is actively processing:

- `111` - fetching
- `121` - scoring
- `211` - summarizing
- `221` - tagging
- `231` - thumbnailing

These states should auto-transition on failure back to their "ready" state.

## Terminal States

States with no outgoing transitions:

- `520` - duplicate
- `530` - irrelevant
- `540` - rejected
- `599` - dead_letter

Items in these states cannot progress further without manual intervention.

## Idempotency

Same-state transitions are always allowed (e.g., `to_summarize → to_summarize`). This enables idempotent updates where status doesn't change but payload is updated.

## Error Handling

### Invalid Transition Error

```
Invalid state transition: to_summarize (210) → to_tag (220).
Valid next states: [summarizing]
```

Error includes:

- Current state name and code
- Target state name and code
- List of valid next states

### Database Trigger Error

```
ERROR: Invalid state transition: 210 → 220 (manual: false)
HINT: Check state machine definition in docs/architecture/pipeline-state-machine.md
```

Database-level validation provides last line of defense.

## Visualization

Generate Mermaid diagram:

```javascript
import { toMermaidDiagram } from './lib/state-machine.js';

const diagram = toMermaidDiagram();
console.log(diagram);
```

Output includes:

- Solid arrows for normal transitions
- Dashed arrows for manual transitions
- Terminal states shown with `[*]`

## Testing

See `services/agent-api/src/lib/state-machine.test.js` for comprehensive test coverage:

- Valid transitions (discovery, enrichment, review, published)
- Invalid transitions (skipping steps, backward without manual flag)
- Manual transitions (re-enrichment)
- Terminal states
- Working states
- Retry states

## Phase 2 Exit Criteria

- [x] State machine defined in database
- [x] All transitions validated at DB and app level
- [x] Invalid transitions prevented (trigger + validation)
- [x] Manual override mechanism implemented
- [x] Tests cover all transition types
- [x] Documentation complete

## Related

- `docs/architecture/pipeline-status-codes.md` - Status code definitions
- `infra/supabase/migrations/20250101000000_add_state_machine_constraints.sql` - Migration
- `services/agent-api/src/lib/state-machine.js` - Implementation
- `services/agent-api/src/lib/state-machine.test.js` - Tests
