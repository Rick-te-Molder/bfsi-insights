# Phase 2 Readiness Roadmap - BFSI Insights

**Goal:** Lift all components to Phase 2 (Observability & Control)  
**Current State:** Between Phase 1 and Phase 2  
**Target Completion:** 6-8 weeks  
**Date Created:** December 31, 2024

---

## Executive Summary

**Timeline:** 6-8 weeks (3 engineers working in parallel)  
**Critical Path:** agent-api (3 weeks) → Supabase (2 weeks) → Admin UI (2 weeks)  
**Budget Estimate:** ~$50-70K (assuming 3 engineers @ $150-200/hr, 480-640 hours total)

**Key Milestones:**

- Week 2: Phase 1 complete (foundation solid)
- Week 4: Metrics & logging operational
- Week 6: Dashboards & control tools live
- Week 8: Phase 2 exit criteria met, validated

---

## Current Component Assessment

| Component         | Current Phase | Score | Primary Gap                      | Effort  |
| ----------------- | ------------- | ----- | -------------------------------- | ------- |
| **Supabase (DB)** | 1 → 2         | 65%   | Event sourcing tables missing    | 2 weeks |
| **agent-api**     | 1             | 45%   | Implicit workflows, no metrics   | 3 weeks |
| **Admin UI**      | 1 → 2         | 70%   | Limited observability dashboards | 2 weeks |
| **Public site**   | 4-ready       | 85%   | Not blocking                     | 0 weeks |

**Critical Path:** agent-api → Supabase → Admin UI

---

## Phase 1 Gaps (Must Complete First)

### ❌ Blocking Issues

**1. Workflow State Machine** (3 days)

- State machine implicit in code, not formally defined
- No validation layer to prevent invalid transitions
- Some transitions not atomic

**2. Event Sourcing** (2 days)

- No `pipeline_event` or `agent_run` tables
- Cannot reconstruct state from events
- Cannot replay items deterministically

**3. Error Classification** (2 days)

- Errors not classified (retryable vs. terminal)
- No exponential backoff with jitter
- No dead-letter queue

**4. Admin Query Performance** (2 days)

- Item location takes >30s for some queries
- Blockers inferred, not explicit

---

## Work Breakdown

### Week 1-2: Phase 1 Completion (Foundation)

#### Task 1.1: Formal State Machine (3 days)

**Deliverables:**

- Define state machine in code with validation
- Make all transitions atomic (DB transactions)
- Add tests

**Files:**

- `services/agent-api/src/lib/state-machine.js` (new)
- `supabase/migrations/YYYYMMDD_add_state_constraints.sql` (new)

---

#### Task 1.2: Event Sourcing Tables (2 days)

**Deliverables:**

- Create `pipeline_event` table
- Create `agent_run` table
- Add triggers to log all state changes

**Schema:**

```sql
CREATE TABLE pipeline_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES kb_publication(id),
  event_type TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor TEXT NOT NULL,
  from_stage TEXT,
  to_stage TEXT,
  input_hash TEXT,
  output_hash TEXT,
  metadata JSONB,
  reason TEXT
);

CREATE TABLE agent_run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES kb_publication(id),
  agent_name TEXT NOT NULL,
  version TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  output_hash TEXT,
  error_code TEXT,
  retry_count INTEGER DEFAULT 0,
  cost_usd DECIMAL(10,4),
  latency_ms INTEGER
);
```

---

#### Task 1.3: Replay Capability (3 days)

**Deliverables:**

- Implement deterministic replay for critical steps
- Add replay API endpoint
- Test on 100 random items

**Acceptance:** 100% success rate for deterministic replay

---

#### Task 1.4: Error Classification & DLQ (2 days)

**Deliverables:**

- Classify all errors (retryable vs. terminal)
- Implement exponential backoff with jitter
- Create dead-letter queue table

**Backoff strategy:**

```typescript
const backoff = {
  base: 1000, // 1 second
  max: 60000, // 60 seconds
  jitter: 0.2, // ±20%
  multiplier: 2,
};
```

---

### Week 3-4: Phase 2 Metrics & Logging

#### Task 2.1: Agent Metrics Collection (3 days)

**Deliverables:**

- Add metrics to all agents (throughput, success rate, latency, cost)
- Store metrics in `agent_run` table
- Create metrics API endpoint

**API:**

```typescript
GET /api/metrics/agents/:agent_name?window=24h
```

---

#### Task 2.2: Structured Logging (2 days)

**Deliverables:**

- Add correlation IDs to all logs
- Standardize log format (JSON)
- Propagate correlation ID across agents

**Log format:**

```json
{
  "timestamp": "2024-12-31T10:00:00Z",
  "level": "info",
  "correlation_id": "req_abc123",
  "agent_name": "fetcher",
  "item_id": "pub_xyz789",
  "message": "Fetched content successfully"
}
```

---

#### Task 2.3: Alerting System (3 days)

**Deliverables:**

- Define alert rules (success rate, latency, cost, queue depth)
- Implement alert evaluation (every 5 minutes)
- Add alert notification (email, Slack)

**Alert rules:**

- Success rate <95%
- Latency >2x baseline
- Cost >budget
- Queue depth >1000

---

### Week 5-6: Phase 2 Dashboards & Control

#### Task 3.1: Workflow Dashboard (3 days)

**Deliverables:**

- Stage distribution chart
- Age distribution chart
- Blocker analysis table
- Real-time updates (every 30 seconds)

**Acceptance:** Dashboard loads in <3 seconds

---

#### Task 3.2: Agent Health Dashboard (3 days)

**Deliverables:**

- Agent metrics table (success rate, latency, cost)
- Trend charts (last 7 days)
- Alert status indicators

---

#### Task 3.3: Control Tools (2 days)

**Deliverables:**

- Retry button (rerun agent on item)
- Skip button (bypass agent)
- Force-approve button (override quality gate)
- Rollback button (revert to previous state)

**Acceptance:** All overrides logged with justification

---

#### Task 3.4: Golden Set (2 days)

**Deliverables:**

- Create 50-100 manually curated examples
- Implement evaluation on agent changes
- Track precision, recall, F1

---

### Week 7-8: Validation & Documentation

#### Task 4.1: Exit Criteria Validation (3 days)

**Run all Phase 2 exit criteria tests:**

- Metrics coverage: 100% of agents
- Log completeness: 100% of runs
- Correlation ID propagation: 100%
- Dashboard latency: <3 seconds
- Override auditability: 100%
- Alert responsiveness: <5 minutes
- Golden set freshness: <1 hour (prompt changes)

---

#### Task 4.2: Documentation (2 days)

**Deliverables:**

- Update architecture docs
- Create runbooks for common operations
- Document all new APIs
- Update README

---

## Resource Plan

### Team Structure

- **Backend Engineer 1:** State machine, event sourcing, replay (Weeks 1-3)
- **Backend Engineer 2:** Metrics, logging, alerting (Weeks 3-5)
- **Frontend Engineer:** Dashboards, control tools (Weeks 5-7)
- **All:** Validation & documentation (Weeks 7-8)

### Dependencies

- Supabase access (already have)
- Render access for agent-api (already have)
- Vercel access for admin UI (already have)
- Slack webhook for alerts (need to create)

---

## Timeline Summary

| Week | Focus                | Deliverables                                    | Owner     |
| ---- | -------------------- | ----------------------------------------------- | --------- |
| 1-2  | Phase 1 Foundation   | State machine, events, replay, DLQ              | Backend 1 |
| 3-4  | Metrics & Logging    | Agent metrics, structured logs, alerts          | Backend 2 |
| 5-6  | Dashboards & Control | Workflow dashboard, agent health, control tools | Frontend  |
| 7-8  | Validation & Docs    | Exit criteria tests, documentation              | All       |

---

## Success Criteria

### Phase 1 Exit (End of Week 2)

- [x] All workflows have explicit state machines
- [x] Every state change logged as event
- [x] Deterministic replay: 100% success
- [x] Admin query: P95 <30s

### Phase 2 Exit (End of Week 8)

- [x] 100% of agents report metrics
- [x] 100% of runs have structured logs
- [x] Dashboards load in <3 seconds
- [x] Alerts fire within 5 minutes
- [x] Golden set evaluated within 1 hour

---

## Risks & Mitigation

**Risk 1:** Event sourcing tables impact performance

- **Mitigation:** Use async inserts, add indexes, monitor query performance

**Risk 2:** Correlation ID propagation complex across agents

- **Mitigation:** Start with simple implementation, iterate

**Risk 3:** Dashboard performance with large datasets

- **Mitigation:** Use materialized views, implement pagination

**Risk 4:** Golden set creation takes longer than expected

- **Mitigation:** Start with 50 examples, expand to 100 later

---

## Next Steps

1. **Approve this roadmap** - Review and confirm timeline/scope
2. **Assign team members** - Identify Backend 1, Backend 2, Frontend
3. **Create Linear issues** - Break down tasks into trackable issues
4. **Kick off Week 1** - Start with Task 1.1 (State Machine)
5. **Weekly check-ins** - Review progress, adjust plan as needed

---

**Questions?**

- Is 6-8 weeks acceptable?
- Do we have 3 engineers available?
- Any tasks to deprioritize if timeline is too long?
