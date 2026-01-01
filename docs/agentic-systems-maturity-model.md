# Agentic Systems Maturity Model (ASMM)

**Version 1.0 | December 31, 2024**

## Executive Summary

The Agentic Systems Maturity Model (ASMM) is a phase-gated framework for building production-grade AI agent systems in regulated environments. Unlike generic AI maturity models, ASMM addresses the critical gap between "AI that works in demos" and "AI that can be trusted, operated, and audited."

**Key differentiators:**

- **Quantifiable exit criteria** - measurable thresholds, not aspirational goals
- **Agentic-AI specific** - covers orchestration, workflows, and human-in-the-loop
- **Audit-oriented architecture** - designed to become audit-ready without refactors
- **Framework-compatible** - aligns with ITIL, COBIT, ISO 27001, DORA, SOC/ISAE

**Target audience:** Organizations building AI agent systems where trust, auditability, and operational stability are non-negotiable (financial services, healthcare, legal, government).

---

## Glossary

**Agent** - An autonomous software component that performs a specific task using AI/ML (e.g., classification, summarization, enrichment). Agents may call LLMs, external APIs, or deterministic logic.

**Workflow** - A sequence of stages that items pass through, with explicit state transitions (e.g., ingestion → fetch → enrich → classify → review → publish).

**Item** - The unit of work flowing through the system (e.g., document, patient case, contract, support ticket).

**Idempotency** - Running an agent multiple times on the same input produces no duplicate side effects and semantically equivalent outputs (not necessarily bit-identical for probabilistic systems).

**Event Sourcing** - Architectural pattern where state changes are stored as immutable events, enabling reconstruction of state and audit trails.

**System of Record** - The authoritative source for a piece of data (e.g., database table, not derived view).

**Derived Artifact** - Data computed from system of record (e.g., cached summary, materialized view).

**Change Type** - Classification of changes by scope: prompt-only, code change, schema change, model change, dependency change.

**Safety Tier** - Impact classification for workflows: low (informational), medium (operational), high (regulated/safety-critical).

**Material Regression** - Quality degradation that impacts user value or trust (not minor statistical fluctuations).

**Error Budget** - Acceptable threshold for failures, regressions, or degradations (borrowed from SRE).

---

## The Seven Phases

**Note on Phase 0:** Some components may be in "Phase 0" (prototype/demo stage) where basic requirements are not yet met. This is captured in the scoring rubric (0-25% = Not Started) rather than as a formal phase. The maturity model begins at Phase 1 (Operational Stability).

### Phase 1: Operational Stability

**Status:** Foundation (unavoidable)  
**Goal:** The system behaves predictably under normal and failure conditions

#### Quantifiable Requirements

**1. Workflow State Machine**

- [ ] Every workflow stage has explicit entry/exit conditions
- [ ] State transitions are atomic (all-or-nothing)
- [ ] Invalid state transitions are impossible (enforced by code)
- [ ] **Metric:** 100% of items have valid state at all times

**2. Idempotency (Side-Effect Safety)**

- [ ] Running agent N times on input X produces no duplicate side effects (e.g., duplicate DB writes, duplicate API calls)
- [ ] For deterministic agents: output is bit-identical
- [ ] For probabilistic agents (LLMs): output is semantically equivalent within tolerance
- [ ] Duplicate requests are detected and deduplicated
- [ ] Partial failures can be safely retried
- [ ] **Metric:** 0 duplicate side effects in 30-day window
- [ ] **Metric (regulated decisions only):** Deterministic mode enforced (fixed seed, model version, temperature=0)

**3. Event Logging & Auditability**

- [ ] Every state change is logged as immutable event
- [ ] Events include: timestamp, actor (human/agent), input hash, output hash, reason
- [ ] Critical state can be reconstructed from event log + snapshots
- [ ] **Metric:** 100% of state changes have corresponding events
- [ ] **Note:** Full event sourcing (rebuild entire state from events) is optional; audit trail completeness is mandatory

**4. Failure Classification**

- [ ] Every error is classified: retryable vs. terminal
- [ ] Retryable errors have exponential backoff with jitter and max backoff
  - E.g., base=1s, max=60s, jitter=±20%
  - Rate limit errors (429): longer backoff (e.g., base=10s)
  - Server errors (5xx): standard backoff
  - Timeout errors: configurable based on downstream SLA
- [ ] Terminal errors go to dead-letter queue immediately
- [ ] **Metric:** <5% of failures are misclassified (measured by manual audit of DLQ)

**5. Replay Capability**

- [ ] **Deterministic replay** for decision-critical steps:
  - Uses stored inputs/outputs from event log
  - Does not re-call external APIs or LLMs
  - Reconstructs state transitions exactly
  - **Metric:** 100% success rate on random sample (n=100)
- [ ] **Best-effort replay** for non-critical enrichment:
  - May re-call external APIs (results may differ)
  - Used for debugging, not compliance
  - **Metric:** >90% success rate
- [ ] Replay does not trigger side effects (writes are simulated)
- [ ] Replay time is <10x original processing time

**6. Admin Transparency**

- [ ] Item location answerable in <30 seconds
- [ ] Full timeline visible: ingestion → current state
- [ ] Blockers are explicit (not inferred)
- [ ] **Metric:** Mean time to locate item <30s

#### Exit Criteria (Auditable)

| Criterion                        | Measurement Method                         | Threshold                           |
| -------------------------------- | ------------------------------------------ | ----------------------------------- |
| **Zero silent failures**         | Error log completeness audit               | 100% of failures logged             |
| **Side-effect idempotency**      | Duplicate side-effect detection            | 0 duplicate side effects in 30 days |
| **Event completeness**           | State change vs. event count               | 1:1 ratio                           |
| **Deterministic replay success** | Random sample replay test (critical steps) | 100% success rate (n=100)           |
| **Best-effort replay success**   | Random sample replay test (non-critical)   | >90% success rate (n=100)           |
| **Admin query speed**            | P95 latency for "where is item X"          | <30 seconds                         |
| **State validity**               | Database constraint violations             | 0 invalid states                    |

#### Example Implementations

**E.g., BFSI Insights (content pipeline):**

- Workflow: `ingestion → fetch → enrich → classify → review → publish`
- Event table: `pipeline_event` with columns `item_id, stage, timestamp, agent_name, input_hash, output_hash, error_code`
- Idempotency: Hash of (item_id + stage + input) prevents duplicate processing

**E.g., Healthcare AI (clinical decision support):**

- Workflow: `intake → triage → diagnosis → recommendation → review → delivery`
- Event table: `clinical_event` with audit trail for regulatory compliance
- Idempotency: Patient ID + timestamp + input hash ensures no duplicate recommendations

**E.g., Legal AI (contract analysis):**

- Workflow: `upload → parse → extract → classify → risk_score → review → report`
- Event table: `contract_event` with full provenance for legal defensibility
- Idempotency: Document hash + analysis version prevents reprocessing

#### Common Failure Modes (Anti-Patterns)

❌ **"It worked yesterday"** - No event log, cannot reconstruct failure  
❌ **Silent failures** - Errors swallowed, items stuck indefinitely  
❌ **State corruption** - Retries create duplicates or inconsistent state  
❌ **Tribal knowledge** - Only founder knows how to debug stuck items  
❌ **Manual fixes** - Database updates bypass event log

---

### Phase 2: Observability & Control

**Status:** From "it works" to "I trust it"  
**Goal:** You understand and steer the system, not chase it

#### Quantifiable Requirements

**1. Agent Metrics (Per Agent, Per Hour)**

- [ ] Throughput: items processed
- [ ] Success rate: % successful runs
- [ ] Latency: P50, P95, P99 processing time
- [ ] Cost: $ per run (API calls, compute)
- [ ] **Metric:** All agents report metrics with <5min lag

**2. Structured Logging**

- [ ] Every log entry has: timestamp, correlation_id, agent_name, level, message
- [ ] Logs are queryable by item, agent, time range, error type
- [ ] Log retention: 90 days minimum
- [ ] **Metric:** 100% of agent runs have structured logs

**3. Correlation IDs**

- [ ] Single ID traces item through entire pipeline
- [ ] ID propagates across agent boundaries
- [ ] ID links logs, metrics, events
- [ ] **Metric:** 100% of multi-agent workflows have correlation ID

**4. Dashboards (Decision-Focused)**

- [ ] Workflow stage distribution (how many items in each stage)
- [ ] Age distribution (how long items have been in each stage)
- [ ] Blocker analysis (top reasons for stuck items)
- [ ] Agent health (success rate, latency, cost trends)
- [ ] **Metric:** Dashboards load in <3 seconds

**5. Manual Override Tools**

- [ ] Retry: rerun agent on specific item
- [ ] Skip: bypass agent, move to next stage
- [ ] Force-approve: override quality gate
- [ ] Rollback: revert to previous state
- [ ] **Metric:** All overrides logged with justification

**6. Alerting**

- [ ] Success rate drops below threshold (e.g., <95%)
- [ ] Latency exceeds threshold (e.g., P95 >2x baseline)
- [ ] Cost exceeds budget (e.g., >$X per day)
- [ ] Queue depth exceeds capacity (e.g., >1000 items)
- [ ] **Metric:** Alerts fire within 5 minutes of threshold breach

**7. Golden Set Evaluation**

- [ ] 50-100 manually curated examples
- [ ] Evaluated on every agent change
- [ ] Tracks: precision, recall, F1 score
- [ ] **Metric (prompt/config changes):** Golden set evaluated within 1 hour of deployment
- [ ] **Metric (code/schema/model changes):** Golden set evaluated within 24 hours of deployment

#### Exit Criteria (Auditable)

| Criterion                                 | Measurement Method                 | Threshold  |
| ----------------------------------------- | ---------------------------------- | ---------- |
| **Metrics coverage**                      | % of agents reporting metrics      | 100%       |
| **Log completeness**                      | % of runs with structured logs     | 100%       |
| **Correlation ID propagation**            | % of workflows with single ID      | 100%       |
| **Dashboard latency**                     | P95 load time                      | <3 seconds |
| **Override auditability**                 | % of overrides with justification  | 100%       |
| **Alert responsiveness**                  | Time from breach to alert          | <5 minutes |
| **Golden set freshness (prompt changes)** | Time since last evaluation         | <1 hour    |
| **Golden set freshness (other changes)**  | Time since last evaluation         | <24 hours  |
| **Volume forecast accuracy**              | MAPE for 1-week ingestion forecast | ≤20%       |

#### Example Implementations

**E.g., BFSI Insights:**

- Metrics: Supabase function `get_agent_metrics(agent_name, time_range)` returns JSON
- Dashboard: Next.js admin page `/items/pipeline` shows stage distribution
- Override: Admin UI button "Retry" calls RPC `retry_item(item_id, reason)`

**E.g., Customer support AI:**

- Metrics: Ticket resolution time, escalation rate, customer satisfaction
- Dashboard: Real-time queue depth, agent utilization, SLA compliance
- Override: Supervisor can reassign ticket, override priority, inject context

**E.g., Financial compliance AI:**

- Metrics: Alert precision, false positive rate, investigation time
- Dashboard: Risk score distribution, regulatory coverage, audit trail completeness
- Override: Compliance officer can suppress alert, adjust risk score, add exception

#### Key Instruments

**Workflow Dashboard:**

```
Stage          | Count | Avg Age | Oldest | Blocked
---------------|-------|---------|--------|--------
Ingestion      | 45    | 2h      | 8h     | 3
Fetch          | 120   | 4h      | 24h    | 12
Enrich         | 89    | 6h      | 48h    | 5
Classify       | 234   | 3h      | 12h    | 8
Review         | 67    | 12h     | 72h    | 15
Publish        | 12    | 1h      | 3h     | 0
```

**Agent Health:**

```
Agent          | Success | P95 Latency | Cost/Run | Runs/Day
---------------|---------|-------------|----------|----------
fetcher        | 98.2%   | 3.2s        | $0.02    | 1,200
enricher       | 95.7%   | 8.5s        | $0.15    | 1,100
classifier     | 99.1%   | 1.8s        | $0.08    | 1,050
summarizer     | 97.4%   | 12.3s       | $0.25    | 980
```

---

### Phase 3: Quality System

**Status:** Editorial + AI  
**Goal:** Outputs are consistently useful, not just correct

#### Quantifiable Requirements

**1. Quality Definitions (Per Content Type)**

- [ ] Explicit rubric with 3-5 dimensions
- [ ] Each dimension has 1-5 scale with examples
- [ ] Inter-rater reliability measured and improving
  - Cohen's kappa >0.8 for binary/categorical labels
  - ICC (Intraclass Correlation) >0.75 for rating scales
  - Krippendorff's alpha >0.7 for multi-rater/mixed data
- [ ] **Metric:** 100% of content types have documented rubric

**2. Human-in-the-Loop Placement**

- [ ] Decision tree: when to route to human (by safety tier)
- [ ] Confidence thresholds calibrated (e.g., <0.7 → human review for medium-risk; all high-risk reviewed)
- [ ] Human review time tracked
- [ ] **Metric (low/medium safety tier):** Review rate decreases over time (target: <20% after 6 months)
- [ ] **Metric (high safety tier):** 100% human review may be required; focus on review efficiency

**3. Evaluation Loops**

- [ ] Precision@K: % of top K results that are relevant
- [ ] Recall@K: % of relevant results in top K
- [ ] False positive rate: % of flagged items that are not issues
- [ ] Drift detection: distribution shift over time
- [ ] **Metric:** Evaluated daily, alerts on >10% degradation

**4. Versioned Prompts**

- [ ] Every prompt has version number (e.g., `v2.3`)
- [ ] Version tied to evaluation results
- [ ] Rollback capability to previous version
- [ ] **Metric:** 100% of prompts versioned, <1 hour rollback time

**5. Regression Detection**

- [ ] Golden set evaluated on every change
- [ ] Automated comparison: new vs. previous version
- [ ] Deployment blocked if material regression detected
- [ ] **Metric:** 0 material regressions reach production in 90 days
- [ ] **Material regression defined as:**
  - Accuracy drop >5% on golden set, OR
  - User-reported quality issues >10% increase, OR
  - Regulatory/safety-critical error introduced
- [ ] **Error budget:** Allow <2% non-material regressions (statistical noise) per quarter

**6. Quality Gates**

- [ ] Automated checks before publication
- [ ] Examples: completeness, consistency, freshness
- [ ] Failed checks block publication or trigger review
- [ ] **Metric:** <1% of published content fails post-publication audit

**7. Feedback Loops**

- [ ] User corrections captured (e.g., "this is wrong")
- [ ] Corrections feed into training data
- [ ] Correction rate tracked over time
- [ ] **Metric:** Correction rate decreases 10% month-over-month

#### Exit Criteria (Auditable)

| Criterion                               | Measurement Method                 | Threshold                            |
| --------------------------------------- | ---------------------------------- | ------------------------------------ |
| **Quality rubric coverage**             | % of content types with rubric     | 100%                                 |
| **Inter-rater reliability**             | Appropriate metric for data type   | >0.7-0.8 (see requirements)          |
| **Human review rate (low/med tier)**    | % of items requiring review        | Decreasing trend, target <20% at 6mo |
| **Human review efficiency (high tier)** | Time per review                    | Decreasing trend                     |
| **Evaluation frequency**                | Days since last evaluation         | <1 day                               |
| **Prompt versioning**                   | % of prompts with version          | 100%                                 |
| **Material regression prevention**      | Material regressions in production | 0 in 90 days                         |
| **Quality gate effectiveness**          | Post-publication failure rate      | <1%                                  |
| **Feedback loop impact**                | Month-over-month correction rate   | -10%                                 |

#### Quality Dimensions (Universal)

**Accuracy** - Factual correctness vs. source material  
**Measurement:** Random sample audit (n=100), % correct  
**Threshold:** >95% accuracy

**Completeness** - All required fields populated  
**Measurement:** Automated schema validation  
**Threshold:** 100% of required fields non-null

**Consistency** - Naming conventions, taxonomy alignment  
**Measurement:** Automated linting, % passing  
**Threshold:** >99% consistency

**Timeliness** - Publication lag vs. source update  
**Measurement:** Median time from source update to publication  
**Threshold:** <24 hours for time-sensitive content

**Relevance** - Audience fit, materiality  
**Measurement:** Role-specific engagement metrics

- E.g., Analysts: >40% click through to source
- E.g., Executives: >30% save or share
- E.g., Compliance: >60% mark as reviewed
  **Threshold:** Engagement improves 10% quarter-over-quarter OR exceeds role baseline

#### Example Implementations

**E.g., Content classification:**

- Quality rubric: Accuracy (1-5), Completeness (1-5), Consistency (1-5)
- Human review: Confidence <0.7 or multi-label ambiguity
- Evaluation: Precision@5, Recall@5, F1 score on golden set
- Prompt version: `classifier-v2.3` with evaluation results in DB

**E.g., Medical diagnosis support:**

- Quality rubric: Clinical accuracy, Evidence strength, Contraindication coverage
- Human review: Confidence <0.9 or high-risk conditions
- Evaluation: Sensitivity, specificity, AUC-ROC on validation set
- Prompt version: `diagnosis-v1.8` with FDA-style validation

**E.g., Legal contract review:**

- Quality rubric: Clause identification, Risk assessment, Precedent alignment
- Human review: High-value contracts (>$1M) or novel clauses
- Evaluation: Precision/recall on clause extraction, risk calibration
- Prompt version: `contract-v3.1` with lawyer validation

---

### Phase 4: Productization

**Status:** Real Users, Real Value  
**Goal:** The system delivers repeatable value to distinct user roles

#### Quantifiable Requirements

**1. User Roles**

- [ ] 3-5 distinct roles defined
- [ ] Each role has: persona, goals, key tasks
- [ ] Role-based access control (RBAC) implemented
- [ ] **Metric:** 100% of users assigned to role

**2. Role-Specific Views**

- [ ] Each role has tailored dashboard
- [ ] Queries optimized for role's common tasks
- [ ] Irrelevant data hidden from role
- [ ] **Metric:** <3 clicks to complete primary task

**3. Stable URLs**

- [ ] Every content item has permanent URL
- [ ] URLs do not change on content update
- [ ] Broken links <0.1%
- [ ] **Metric:** 100% of content has stable URL

**4. Subscription Logic**

- [ ] Users can subscribe to: topics, sources, alerts
- [ ] Subscription preferences stored and respected
- [ ] Unsubscribe honored immediately
- [ ] **Metric:** <5% unsubscribe rate

**5. User Documentation**

- [ ] Getting started guide (<5 pages)
- [ ] Role-specific tutorials
- [ ] FAQ with top 20 questions
- [ ] **Metric:** <10% of users contact support in first 30 days

**6. Onboarding Flows**

- [ ] Self-service account creation
- [ ] Interactive tutorial (5-10 minutes)
- [ ] Sample data for exploration
- [ ] **Metric:** >80% complete onboarding

**7. API Contracts**

- [ ] Versioned API (e.g., `/v1/`, `/v2/`)
- [ ] OpenAPI/Swagger documentation
- [ ] Deprecation policy (e.g., 6 months notice)
- [ ] **Metric:** 100% of endpoints documented

#### Exit Criteria (Auditable)

| Criterion                      | Measurement Method                 | Threshold |
| ------------------------------ | ---------------------------------- | --------- |
| **Role coverage**              | % of users with assigned role      | 100%      |
| **Task efficiency**            | Clicks to complete primary task    | <3 clicks |
| **URL stability**              | % of URLs unchanged in 90 days     | >99.9%    |
| **Subscription accuracy**      | % of preferences honored           | 100%      |
| **Documentation completeness** | % of features documented           | 100%      |
| **Onboarding completion**      | % of new users completing tutorial | >80%      |
| **API documentation**          | % of endpoints with OpenAPI spec   | 100%      |
| **User retention**             | % of users active after 30 days    | >60%      |

#### User Journey Milestones

**Discovery** - User finds relevant content  
**Measurement:** Time to first relevant result  
**Threshold:** <30 seconds

**Comprehension** - User understands provenance  
**Measurement:** % of users who view source metadata  
**Threshold:** >40%

**Action** - User exports, cites, or integrates  
**Measurement:** % of sessions with action  
**Threshold:** >30%

**Return** - User bookmarks or subscribes  
**Measurement:** % of users returning within 7 days  
**Threshold:** >50%

#### Example Implementations

**E.g., BFSI Insights user roles:**

- **Compliance Officer:** Monitors regulatory changes, exports reports
- **Product Owner:** Tracks competitor features, identifies opportunities
- **Auditor:** Reviews data lineage, validates classifications
- **Vendor:** Submits product updates, monitors mentions

**E.g., Healthcare AI user roles:**

- **Clinician:** Reviews diagnostic suggestions, provides feedback
- **Administrator:** Monitors system performance, manages access
- **Researcher:** Analyzes aggregate data, validates models
- **Patient:** Views personalized health insights, asks questions

**E.g., Legal AI user roles:**

- **Associate:** Drafts contracts, checks precedents
- **Partner:** Reviews high-risk clauses, approves exceptions
- **Paralegal:** Organizes documents, tracks deadlines
- **Client:** Views case status, accesses documents

---

### Phase 5: Governance & Trust

**Status:** Audit-Ready  
**Goal:** The system can survive regulatory scrutiny

#### Quantifiable Requirements

**1. Data Lineage**

- [ ] Every output traces to source(s)
- [ ] Transformations documented (agent, version, timestamp)
- [ ] Lineage graph visualized
- [ ] **Metric:** 100% of outputs have complete lineage

**2. Explainability**

- [ ] Every classification has justification
- [ ] Justification includes: confidence, key features, reasoning
- [ ] Justification stored with output
- [ ] **Metric:** 100% of outputs have explainability metadata

**3. Access Control**

- [ ] Role-based permissions enforced
- [ ] Data sensitivity levels defined (public, internal, confidential)
- [ ] Access logs retained per regulatory/contractual requirements
  - E.g., 7 years for SEC/FINRA (US financial services)
  - E.g., 6 years for HIPAA (US healthcare)
  - E.g., Varies by jurisdiction for GDPR (EU)
- [ ] **Metric:** 0 unauthorized access attempts succeed

**4. Audit Trails**

- [ ] Every content change logged (who, what, when, why)
- [ ] Approvals and overrides logged
- [ ] Logs are immutable (append-only)
- [ ] **Metric:** 100% of changes have audit trail

**5. Uncertainty Quantification**

- [ ] Confidence scores calibrated (e.g., 70% confident → 70% accurate)
- [ ] Hallucination risk flagged
- [ ] Ambiguity explicitly stated
- [ ] **Metric:** Confidence calibration error <5%

**6. Sourcing Transparency**

- [ ] Primary sources clearly marked
- [ ] Derived content labeled as such
- [ ] Source quality indicators (e.g., peer-reviewed, official)
- [ ] **Metric:** 100% of content has source attribution

**7. Change Management**

- [ ] Schema changes versioned
- [ ] Backward compatibility maintained for 6 months
- [ ] Breaking changes announced 30 days in advance
- [ ] **Metric:** 0 unannounced breaking changes

**8. Incident Response**

- [ ] Playbook for quality failures
- [ ] Playbook for data breaches
- [ ] Playbook for system outages
- [ ] **Metric:** Incident response time <1 hour

#### Exit Criteria (Auditable)

| Criterion                        | Measurement Method               | Threshold |
| -------------------------------- | -------------------------------- | --------- |
| **Lineage completeness**         | % of outputs with full lineage   | 100%      |
| **Explainability coverage**      | % of outputs with justification  | 100%      |
| **Access control effectiveness** | Unauthorized access success rate | 0%        |
| **Audit trail completeness**     | % of changes with audit entry    | 100%      |
| **Confidence calibration**       | Mean absolute calibration error  | <5%       |
| **Source attribution**           | % of content with source         | 100%      |
| **Breaking change notice**       | Days of advance notice           | >30 days  |
| **Incident response time**       | P95 time to first response       | <1 hour   |

#### Governance Primitives

**Lineage Graph Example:**

```
Source Document (PDF)
  ↓ [fetcher-v2.1, 2024-12-15 10:23:45]
Raw Text
  ↓ [enricher-v1.8, 2024-12-15 10:24:12]
Structured Data
  ↓ [classifier-v2.3, 2024-12-15 10:24:45]
Classification (confidence=0.87)
  ↓ [summarizer-v3.0, 2024-12-15 10:25:30]
Summary
  ↓ [reviewer (human), 2024-12-15 11:15:00]
Published Content
```

**Decision Log Entry:**

```json
{
  "decision_id": "dec_abc123",
  "timestamp": "2024-12-15T10:24:45Z",
  "agent": "classifier-v2.3",
  "input_hash": "sha256:...",
  "output": { "category": "regulation", "confidence": 0.87 },
  "reasoning": "Document contains regulatory language (keywords: 'shall', 'must', 'compliance') and references specific regulations (MiFID II, GDPR).",
  "alternatives": [
    { "category": "guidance", "confidence": 0.12 },
    { "category": "opinion", "confidence": 0.01 }
  ]
}
```

**Confidence Metadata:**

```json
{
  "confidence": 0.87,
  "calibration": "This confidence level historically corresponds to 85% accuracy (±2%)",
  "uncertainty_sources": [
    "Ambiguous language in source document",
    "Limited training data for this document type"
  ],
  "hallucination_risk": "low",
  "human_review_recommended": false
}
```

#### Example Implementations

**E.g., Financial services:**

- Lineage: Every trade recommendation traces to market data source
- Explainability: "Recommended based on P/E ratio (15.2), sector momentum (+8%), analyst consensus (Buy)"
- Audit trail: SEC-compliant 7-year retention, immutable logs

**E.g., Healthcare:**

- Lineage: Every diagnosis traces to patient data, medical literature, clinical guidelines
- Explainability: "Diagnosis based on symptoms (fever, cough), lab results (elevated WBC), imaging (chest X-ray)"
- Audit trail: HIPAA-compliant access logs, de-identification for research

**E.g., Legal:**

- Lineage: Every contract clause traces to precedent, statute, or custom language
- Explainability: "Clause flagged as high-risk due to unlimited liability, non-standard indemnification"
- Audit trail: Attorney-client privilege protection, work product doctrine compliance

---

### Phase 6: Scalability & Moat

**Status:** Growth without degradation  
**Goal:** More data → better results, not more chaos

#### Quantifiable Requirements

**1. Cost Control**

- [ ] Cost per item tracked by: agent, workflow stage, customer
- [ ] Budget alerts at 80%, 90%, 100% of limit
- [ ] Cost optimization opportunities identified monthly
- [ ] **Metric:** Unit cost decreases 10% quarter-over-quarter

**2. Multi-Tenant Separation**

- [ ] Customer data logically or physically isolated
- [ ] No cross-tenant data leakage
- [ ] Per-tenant performance SLAs
- [ ] **Metric:** 0 cross-tenant data access incidents

**3. Taxonomy Depth**

- [ ] Taxonomy has 3+ levels (e.g., industry → sector → subsector)
- [ ] Taxonomy coverage >80% of domain
- [ ] Taxonomy updated quarterly
- [ ] **Metric:** Taxonomy depth as competitive differentiator

**4. Accumulated Evaluation Data**

- [ ] 10,000+ human-labeled examples
- [ ] Evaluation data spans 12+ months
- [ ] Evaluation data covers edge cases
- [ ] **Metric:** Evaluation data as proprietary asset

**5. Domain Extensibility**

- [ ] New domain onboarded in <30 days
- [ ] Domain-specific agents reuse core infrastructure
- [ ] Domain-specific taxonomies integrate with core
- [ ] **Metric:** Time to onboard new domain <30 days

**6. Network Effects**

- [ ] User corrections improve model for all users
- [ ] More usage → more training data → better models
- [ ] Feedback loops are positive, not negative
- [ ] **Metric:** Model accuracy improves 5% year-over-year

**7. Data Flywheel**

- [ ] More data → better models → more users → more data
- [ ] Flywheel velocity measurable
- [ ] Flywheel accelerates over time
- [ ] **Metric:** User growth rate >20% year-over-year

#### Exit Criteria (Auditable)

| Criterion                  | Measurement Method                  | Threshold |
| -------------------------- | ----------------------------------- | --------- |
| **Unit cost reduction**    | Cost per item quarter-over-quarter  | -10%      |
| **Multi-tenant isolation** | Cross-tenant access incidents       | 0         |
| **Taxonomy depth**         | Levels in taxonomy tree             | ≥3        |
| **Evaluation data volume** | Human-labeled examples              | >10,000   |
| **Domain onboarding time** | Days to launch new domain           | <30 days  |
| **Model improvement rate** | Accuracy year-over-year             | +5%       |
| **User growth rate**       | Active users year-over-year         | +20%      |
| **Scalability**            | Performance degradation at 10x load | <10%      |

#### Moat Indicators

**Taxonomy Coverage:**

- Breadth: % of domain covered
- Depth: Levels of hierarchy
- Freshness: Days since last update
- Uniqueness: % of taxonomy not available elsewhere

**Historical Data:**

- Volume: Total items in corpus
- Span: Years of historical data
- Quality: % of items with human validation
- Exclusivity: % of data not publicly available

**User Corrections:**

- Volume: Total corrections received
- Quality: % of corrections incorporated
- Impact: Accuracy improvement from corrections
- Proprietary: % of corrections not available to competitors

**Domain Expertise:**

- Embedded in prompts: % of prompts with domain knowledge
- Embedded in schemas: % of schemas with domain structure
- Embedded in evaluation: % of evaluation criteria domain-specific
- Transferable: % of expertise applicable to new domains

#### Example Implementations

**E.g., BFSI Insights:**

- Cost: $0.15 per article processed (down from $0.25 in Q1)
- Taxonomy: 4 levels (domain → industry → process → subprocess), 500+ nodes
- Evaluation data: 15,000 human-labeled articles over 18 months
- Domain extensibility: Added "insurance" domain in 22 days

**E.g., Healthcare AI:**

- Cost: $2.50 per patient analysis (down from $4.00 in Q1)
- Taxonomy: 5 levels (specialty → condition → symptom → severity → treatment), 10,000+ nodes
- Evaluation data: 50,000 de-identified patient cases over 3 years
- Domain extensibility: Added "mental health" specialty in 28 days

**E.g., Legal AI:**

- Cost: $5.00 per contract review (down from $8.00 in Q1)
- Taxonomy: 4 levels (jurisdiction → practice area → clause type → risk level), 2,000+ nodes
- Evaluation data: 25,000 attorney-reviewed contracts over 2 years
- Domain extensibility: Added "employment law" practice area in 25 days

---

### Phase 7: Institutional Product

**Status:** Outlives the founder  
**Goal:** The product is transferable and sustainable

#### Quantifiable Requirements

**1. Operational Independence**

- [ ] 3+ people can operate system
- [ ] No single point of failure (person)
- [ ] Runbooks for all critical operations
- [ ] **Metric:** System operates for 30 days without founder intervention

**2. Documented Decisions**

- [ ] Architecture decision records (ADRs)
- [ ] Design docs for major features
- [ ] Postmortems for incidents
- [ ] **Metric:** 100% of major decisions documented

**3. Founder Replaceability**

- [ ] Founder can take 2-week vacation
- [ ] No "founder-only" knowledge
- [ ] Succession plan exists
- [ ] **Metric:** 0 founder-only tasks

**4. Customer Dependency**

- [ ] System is mission-critical for customers
- [ ] Customers have integration dependencies
- [ ] Switching cost is high
- [ ] **Metric:** >90% annual retention rate

**5. Institutional Memory**

- [ ] Knowledge base with 100+ articles
- [ ] Architecture Decision Records (ADRs) for all major decisions
- [ ] Runbook coverage for all critical operations
- [ ] Data model documented with ER diagrams and data dictionary
- [ ] **Metric:** New team member productive in <7 days
- [ ] **Metric:** Incident drill success rate >90% (team can respond without founder)

**6. Succession Planning**

- [ ] Key roles have backups
- [ ] Knowledge transfer process defined
- [ ] Transition plan for founder exit
- [ ] **Metric:** All key roles have documented succession plan

#### Exit Criteria (Auditable)

| Criterion                       | Measurement Method                | Threshold |
| ------------------------------- | --------------------------------- | --------- |
| **Operational redundancy**      | People who can operate system     | ≥3        |
| **Decision documentation**      | % of major decisions with ADR     | 100%      |
| **Founder independence**        | Days founder can be absent        | >14 days  |
| **Customer retention**          | Annual retention rate             | >90%      |
| **Knowledge base completeness** | Articles in knowledge base        | >100      |
| **Onboarding time**             | Days to productivity for new hire | <7 days   |
| **Succession planning**         | % of key roles with backup        | 100%      |

#### Institutional Maturity Indicators

**Documentation:**

- Architecture decision records (ADRs)
- Design documents
- Runbooks
- Postmortems
- Knowledge base articles

**Process:**

- Incident response playbooks
- Change management procedures
- Release processes
- Onboarding checklists
- Performance review criteria

**Culture:**

- Blameless postmortems
- Knowledge sharing (e.g., weekly demos)
- Documentation-first mindset
- Succession planning

**Sustainability:**

- Revenue > costs
- Customer retention >90%
- Employee retention >80%
- Founder can step away

---

## Framework Foundations

ASMM synthesizes proven frameworks adapted for agentic AI systems:

### 1. Site Reliability Engineering (Google SRE)

**Influence:** Reliability before features, observability before optimization  
**Mapping:** Phase 1-2 boundary mirrors SRE's "operability first" doctrine  
**Metrics:** Error budgets, SLIs, SLOs adapted for agent systems

### 2. ITIL (Service Maturity)

**Influence:** From "works" → "controlled" → "governed"  
**Mapping:** Phases 2, 4, 5 mirror IT service maturity stages  
**Metrics:** Incident, problem, change management KPIs

### 3. MLOps (Industry-wide)

**Influence:** Training ≠ evaluation ≠ serving, version everything, drift is inevitable  
**Mapping:** Phase 3 (Quality System) adapted from MLOps for agentic systems  
**Metrics:** Model performance, drift detection, A/B testing

### 4. Internal Audit & Control (COBIT / SOC / ISAE)

**Influence:** Traceability, explainability, evidence, separation of duties  
**Mapping:** Phase 5 governance requirements  
**Metrics:** Audit trail completeness, access control effectiveness

### 5. Product Maturity (Silicon Valley practice)

**Influence:** How data platforms and risk tooling actually mature  
**Mapping:** Phases 4, 6, 7 reflect real-world product evolution  
**Metrics:** User retention, NPS, revenue growth

**Key insight:** ASMM does not compete with these frameworks - it prepares organizations to apply them meaningfully.

---

## Assessment Methodology

### Maturity Scan Process (2-3 weeks)

**Week 1: Discovery**

- Interview stakeholders (engineering, product, compliance)
- Review architecture documentation
- Audit event logs and metrics
- Test admin tools and dashboards

**Week 2: Evaluation**

- Score each phase (0-100%)
- Identify bottlenecks
- Map dependencies
- Prioritize improvements

**Week 3: Recommendations**

- Phase placement per component
- Exit criteria checklist
- Recommended next phase only
- "What not to do yet" guidance

### Scoring Rubric (Per Phase)

**0-25%: Not Started**

- Requirements not understood
- No implementation
- No plan to implement

**26-50%: In Progress**

- Requirements understood
- Partial implementation
- Plan exists but incomplete

**51-75%: Mostly Complete**

- Most requirements met
- Implementation functional
- Some exit criteria not met

**76-100%: Complete**

- All requirements met
- All exit criteria met
- Auditable evidence exists

### Component Assessment Template

| Component   | Phase | Score | Bottleneck             | Next Action             |
| ----------- | ----- | ----- | ---------------------- | ----------------------- |
| Database    | 1 → 2 | 65%   | Missing event sourcing | Add event tables        |
| Agent API   | 1     | 45%   | Implicit workflows     | Formalize state machine |
| Admin UI    | 1 → 2 | 70%   | Limited observability  | Add metrics dashboard   |
| Public Site | 4     | 85%   | N/A                    | Maintain                |
| Taxonomies  | 3 → 6 | 80%   | Underutilized          | Leverage after Phase 1  |
| Evaluation  | 0 → 1 | 20%   | Not systematized       | Wait for Phase 1        |
| Governance  | 0     | 5%    | Premature              | Defer to Phase 5        |

---

## Consultancy Product Positioning

### Value Proposition

**Problem:** "Our AI agents work in demos but fail in production. We don't know if we're ready for real users."

**Solution:** ASMM provides a phase-gated roadmap from "it works" to "it's trustworthy" with quantifiable exit criteria at each stage.

**Outcome:** Organizations move from reactive firefighting to proactive maturity, reducing risk and accelerating time-to-trust.

### Target Customers

**Primary:**

- Financial services (banks, asset managers, fintechs)
- Healthcare (hospitals, payers, pharma)
- Legal (law firms, legal tech, compliance)
- Government (regulators, agencies, defense)

**Secondary:**

- Any organization building AI agents where trust matters
- Organizations preparing for regulatory scrutiny (EU AI Act, etc.)
- Organizations scaling from pilot to production

### Differentiation

**vs. Generic AI Maturity Models:**

- ASMM is agentic-specific (orchestration, workflows, HITL)
- ASMM has quantifiable exit criteria (not aspirational)
- ASMM is audit-ready from day one

**vs. MLOps Frameworks:**

- ASMM covers product and governance, not just engineering
- ASMM addresses human-in-the-loop explicitly
- ASMM is designed for regulated environments

**vs. Compliance Frameworks (ISO, SOC, etc.):**

- ASMM sits before compliance (prepares for it)
- ASMM is phase-gated (not all-or-nothing)
- ASMM is operationally focused (not just policy)

### Service Offerings

**1. Maturity Scan (2-3 weeks, fixed price)**

- Phase placement per component
- Bottleneck identification
- Recommended next phase
- Exit criteria checklist

**2. Phase-Specific Interventions (4-8 weeks, fixed scope)**

- Phase 1: Stabilization sprint
- Phase 2: Observability & control design
- Phase 3: Quality system implementation
- Phase 5: Governance readiness

**3. Ongoing Advisory (monthly retainer)**

- Quarterly maturity re-assessment
- Roadmap refinement
- Incident review and postmortems
- Regulatory landscape monitoring

**4. (Later) Accelerators & Tooling**

- Reference architectures
- Admin UI patterns
- Event schemas
- Evaluation templates

---

## Appendix: Phase Transition Checklists

### Phase 1 → Phase 2

**Workflow & State:**

- [ ] All workflows have explicit state machines
- [ ] State transitions are atomic
- [ ] Invalid transitions are impossible
- [ ] 100% of items have valid state

**Events & Replay:**

- [ ] Every state change logged as event
- [ ] Events include timestamp, actor, input, output, reason
- [ ] System state reconstructable from events
- [ ] 100% of items can be replayed

**Failure Handling:**

- [ ] Errors classified: retryable vs. terminal
- [ ] Retryable errors have exponential backoff
- [ ] Terminal errors go to dead-letter queue
- [ ] <5% of failures misclassified

**Admin Transparency:**

- [ ] Item location answerable in <30s
- [ ] Full timeline visible
- [ ] Blockers explicit
- [ ] P95 query latency <30s

**Audit Evidence:**

- [ ] 30-day event log audit shows 100% completeness
- [ ] Replay test on random sample (n=100) shows 100% success
- [ ] Duplicate detection test shows 0 duplicates
- [ ] Admin query performance test shows P95 <30s

---

### Phase 2 → Phase 3

**Metrics & Logging:**

- [ ] All agents report metrics with <5min lag
- [ ] 100% of runs have structured logs
- [ ] 100% of workflows have correlation ID
- [ ] Dashboards load in <3s

**Control & Override:**

- [ ] Manual override tools operational
- [ ] 100% of overrides logged with justification
- [ ] Alerts fire within 5min of threshold breach
- [ ] Golden set evaluated within 1 hour of deployment

**Predictability:**

- [ ] Ingestion volume forecast: MAPE (Mean Absolute Percentage Error) ≤20% for 1-week ahead
- [ ] Queue depth forecast: ±30% accuracy for peak periods
- [ ] Capacity planning documented with growth scenarios
- [ ] Cost per agent tracked and trended
- [ ] Success rate >95% for all agents (or documented error budget)

**Audit Evidence:**

- [ ] Metrics dashboard audit shows 100% agent coverage
- [ ] Log completeness audit shows 100% structured logs
- [ ] Alert responsiveness test shows <5min latency
- [ ] Override audit shows 100% with justification

---

### Phase 3 → Phase 4

**Quality Definitions:**

- [ ] 100% of content types have rubric
- [ ] Inter-rater reliability >0.8
- [ ] <20% of items require human review
- [ ] Evaluated daily, alerts on >10% degradation

**Versioning & Regression:**

- [ ] 100% of prompts versioned
- [ ] Rollback time <1 hour
- [ ] 0 regressions in production (90 days)
- [ ] Post-publication failure rate <1%

**Feedback Loops:**

- [ ] User corrections captured
- [ ] Corrections feed into training data
- [ ] Correction rate decreases 10% month-over-month
- [ ] Quality gates block low-quality content

**Audit Evidence:**

- [ ] Quality rubric audit shows 100% coverage
- [ ] Inter-rater reliability test (n=100) shows >0.8
- [ ] Regression test on golden set shows 0 regressions
- [ ] Feedback loop analysis shows -10% correction rate

---

### Phase 4 → Phase 5

**User Roles & Access:**

- [ ] 100% of users assigned to role
- [ ] <3 clicks to complete primary task
- [ ] > 99.9% of URLs stable (90 days)
- [ ] 100% of subscription preferences honored

**Documentation & Onboarding:**

- [ ] 100% of features documented
- [ ] > 80% complete onboarding
- [ ] 100% of API endpoints have OpenAPI spec
- [ ] <10% of users contact support (first 30 days)

**Retention & Engagement:**

- [ ] > 60% of users active after 30 days
- [ ] > 50% of users return within 7 days
- [ ] > 30% of sessions include action
- [ ] Time to first relevant result <30s

**Audit Evidence:**

- [ ] User role audit shows 100% assignment
- [ ] Task efficiency test (n=50) shows <3 clicks
- [ ] URL stability audit shows >99.9%
- [ ] Retention analysis shows >60% at 30 days

---

### Phase 5 → Phase 6a (Scalability)

**Lineage & Explainability:**

- [ ] 100% of outputs have complete lineage
- [ ] 100% of outputs have explainability metadata
- [ ] Confidence calibration error <5%
- [ ] 100% of content has source attribution

**Access & Audit:**

- [ ] 0% unauthorized access success rate
- [ ] 100% of changes have audit trail
- [ ] > 30 days advance notice for breaking changes
- [ ] Incident response time <1 hour (P95)

**Change Management:**

- [ ] Schema changes versioned
- [ ] Backward compatibility for 6 months
- [ ] 0 unannounced breaking changes
- [ ] Incident playbooks tested

**Audit Evidence:**

- [ ] Lineage audit shows 100% completeness
- [ ] Explainability audit shows 100% coverage
- [ ] Access control test shows 0% unauthorized success
- [ ] Audit trail audit shows 100% completeness

---

### Phase 6a → Phase 7 (or Phase 6b if pursuing commercial moat)

**Cost & Scale:**

- [ ] Unit cost stable or decreasing
- [ ] 0 cross-tenant data access incidents
- [ ] Performance degradation <20% at 10x load
- [ ] Time to onboard new domain <30 days

**Quality at Scale:**

- [ ] Accuracy variance <2% across volume ranges
- [ ] Auto-scaling tested and operational
- [ ] Load testing at 10x completed
- [ ] Quality metrics stable as volume increases

**Audit Evidence:**

- [ ] Cost analysis shows stable or decreasing trend
- [ ] Multi-tenant isolation test shows 0 incidents
- [ ] Load test shows <20% latency increase at 10x
- [ ] Domain onboarding log shows <30 days
- [ ] Quality stability test shows <2% variance

---

### Phase 6b (Business Moat) - Optional

**Taxonomy & Data Assets:**

- [ ] Taxonomy depth ≥3 levels
- [ ] Taxonomy coverage >80% of domain
- [ ] > 10,000 human-labeled examples
- [ ] Evaluation data spans >12 months

**Network Effects:**

- [ ] User corrections improve model accuracy
- [ ] Model accuracy improves 5% year-over-year from feedback
- [ ] Feedback loops are positive
- [ ] Data flywheel measurable and accelerating

**Audit Evidence:**

- [ ] Taxonomy audit shows depth ≥3, coverage >80%
- [ ] Evaluation data inventory shows >10,000 examples
- [ ] Accuracy trend analysis shows +5% year-over-year
- [ ] User growth analysis (if applicable) shows >20% year-over-year

---

### Phase 7 (Institutional Maturity)

**Operational Independence:**

- [ ] ≥3 people can operate system
- [ ] System operates 30 days without founder
- [ ] 0 founder-only tasks
- [ ] All key roles have documented succession plan

**Documentation & Knowledge:**

- [ ] 100% of major decisions have ADR
- [ ] > 100 articles in knowledge base
- [ ] New team member productive in <7 days
- [ ] Code is self-documenting

**Sustainability:**

- [ ] Annual retention rate >90%
- [ ] Revenue > costs
- [ ] Employee retention >80%
- [ ] Founder can take 2-week vacation

**Audit Evidence:**

- [ ] Operational redundancy test shows ≥3 people
- [ ] Founder absence test shows 30-day independence
- [ ] Documentation audit shows 100% ADR coverage
- [ ] Retention analysis shows >90% annual retention

---

## Document Metadata

**Version:** 1.0  
**Date:** December 31, 2024  
**Status:** Final  
**Authors:** Rick te Molder (BFSI Insights), with synthesis from SRE, ITIL, MLOps, COBIT frameworks  
**Next Review:** March 31, 2025  
**Changelog:**

- v1.0 (2024-12-31): Initial release
  - Quantifiable exit criteria for all phases
  - Product-agnostic examples (BFSI, healthcare, legal)
  - Realistic metrics for probabilistic systems
  - Error budget approach for regressions
  - Split Phase 6 into operational (6a) and commercial (6b)
  - Added glossary and conceptual clarifications

---

## v1.0 Quality Checklist

- [x] All phases have quantifiable exit criteria
- [x] All metrics have measurement methods and thresholds
- [x] Examples are product-agnostic (BFSI, healthcare, legal, internal)
- [x] Audit evidence is concrete and verifiable
- [x] Consultancy positioning is clear
- [x] Framework foundations are cited
- [x] Phase transition checklists are complete
- [x] Glossary defines key terms
- [x] Metrics are realistic for probabilistic systems
- [x] Error budget approach for regressions
- [x] Phase 6 split into operational (6a) and commercial (6b)
- [x] Version/date consistency verified

**Status:** v1.0 Final - December 31, 2024
