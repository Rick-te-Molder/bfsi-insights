# KB-207: Implement Best-in-Class Prompt Engineering

## Problem Statement

Despite significant work on code quality and data integrity (status code system, dashboard views), we missed critical prompt management gaps:

1. **Incomplete prompt_versions table** - No inventory of agents vs. their DB prompts
2. **Hardcoded FALLBACK_PROMPT** - Silent fallback masked the problem
3. **Config vs. LLM prompt confusion** - Same table, different purposes, no schema distinction

### Root Causes

| Issue              | Why It Wasn't Caught                                  |
| ------------------ | ----------------------------------------------------- |
| Silent Failures    | `console.warn()` instead of `throw` - system "worked" |
| No Prompt Registry | No single source of truth listing all agents          |
| Observability Gap  | Dashboard for pipeline status, but not prompt health  |
| Review Blind Spot  | PRs don't require prompt migration files              |

---

## Maturity Model

| Level               | Description                          | BFSI Status    |
| ------------------- | ------------------------------------ | -------------- |
| **L1: Ad-hoc**      | Hardcoded prompts in code            | ✅ Exited      |
| **L2: Centralized** | All prompts in DB, versioned         | 🔄 In Progress |
| **L3: Evaluated**   | Automated evals on prompt changes    | ⏳ Next        |
| **L4: Optimized**   | A/B testing, continuous improvement  | 📋 Planned     |
| **L5: Governed**    | Full audit trail, approval workflows | 🔮 Future      |

---

## Phased Implementation Plan

### Phase 1: Foundation (L2 Complete) — 1 day

**Goal:** Establish agent registry and ensure 100% prompt coverage

#### 1.1 Create Agent Manifest

- [ ] Create `docs/agents/manifest.yaml` listing all agents
- [ ] For each agent, declare:
  - Agent name/slug
  - Required prompts (by `agent_name` in `prompt_versions`)
  - Required taxonomy tables (if any)
  - Owner/maintainer

```yaml
# docs/agents/manifest.yaml
agents:
  - name: discovery-relevance
    description: Scores content relevance for each audience
    prompts:
      - discovery-relevance # LLM scoring prompt
    tables:
      - kb_audience # Loads audience definitions
    owner: system

  - name: summarize
    description: Generates summaries and extracts metadata
    prompts:
      - content-summarizer
    tables: []
    owner: system

  - name: taxonomy-tagger
    description: Classifies content with taxonomy codes
    prompts:
      - taxonomy-tagger
    tables:
      - taxonomy_config
      - kb_industry
      - kb_topic
      - kb_geography
      # ... etc
    owner: system
```

#### 1.2 Audit Current State

- [ ] Query `prompt_versions` for all current prompts
- [ ] Compare against manifest - identify gaps
- [ ] Migrate any remaining hardcoded prompts to DB

#### 1.3 Add CI Prompt Coverage Check

- [ ] Create script `scripts/ci/check-prompt-coverage.js`
- [ ] Reads manifest, queries DB (or uses seed files)
- [ ] Fails CI if any declared prompt is missing
- [ ] Add to GitHub Actions workflow

#### 1.4 Update Coding Practices

- [ ] Add rule: "Every agent must be declared in manifest"
- [ ] Add rule: "Every prompt change requires migration file"

---

### Phase 2: Observability (L2+) — 2-3 days

**Goal:** Dashboard visibility into prompt health and usage

#### 2.1 Prompt Health Dashboard (Admin UI)

- [ ] New page: `/prompts` or `/admin/prompts`
- [ ] Shows all agents from manifest
- [ ] For each agent:
  - Current prompt version
  - Last updated date
  - Status: ✅ In DB / ❌ Missing / ⚠️ Outdated
- [ ] Link to edit/view full prompt text

#### 2.2 Prompt Version History View

- [ ] Show all versions for an agent
- [ ] Diff view between versions
- [ ] Rollback button (sets `is_current = true` on old version)

#### 2.3 Basic Usage Metrics (Optional)

- [ ] Track prompt usage in `prompt_usage_log` table:
  ```sql
  CREATE TABLE prompt_usage_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_name TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    called_at TIMESTAMPTZ DEFAULT now(),
    tokens_used INT,
    latency_ms INT
  );
  ```
- [ ] Display in dashboard: calls/day, avg tokens, avg latency

---

### Phase 3: Evaluation (L3) — 1 week

**Goal:** Automated quality checks on prompt changes

#### 3.1 Golden Test Sets

- [ ] Create `tests/evals/` directory
- [ ] For each core agent, create test set:
  ```
  tests/evals/
    discovery-relevance/
      dataset.json      # Input examples
      expected.json     # Expected outputs/scores
      eval.spec.js      # Test runner
    summarize/
      ...
    taxonomy-tagger/
      ...
  ```

#### 3.2 Eval Dataset Structure

```json
// tests/evals/discovery-relevance/dataset.json
[
  {
    "id": "ecb-regulation-2024",
    "input": {
      "title": "ECB publishes new digital euro framework",
      "description": "The European Central Bank...",
      "source": "ecb"
    },
    "expected": {
      "min_score": 7,
      "primary_audience": "executive",
      "must_queue": true
    }
  },
  {
    "id": "academic-theory-paper",
    "input": {
      "title": "A Theoretical Framework for...",
      "description": "This paper presents...",
      "source": "arxiv"
    },
    "expected": {
      "max_score": 4,
      "primary_audience": "researcher",
      "must_queue": false
    }
  }
]
```

#### 3.3 Eval Runner

- [ ] Script that runs prompt against dataset
- [ ] Compares outputs to expected values
- [ ] Reports pass/fail with details
- [ ] Can run against:
  - Current DB prompt
  - A specific version
  - A local prompt file (for testing before commit)

#### 3.4 CI Integration

- [ ] Run evals on PRs that touch prompt files/migrations
- [ ] Block merge if score regression > threshold
- [ ] Generate eval report as PR comment

---

### Phase 4: Optimization (L4) — 2-4 weeks

**Goal:** Data-driven prompt improvement

#### 4.1 Braintrust Integration (Recommended)

Based on analysis, **Braintrust free tier** is best fit:

- 1M spans/month (enough for all runs)
- 10k scores/month
- Unlimited users
- 14-day retention (export important results to Supabase)

**Integration steps:**

- [ ] Create Braintrust account
- [ ] Install SDK: `npm install braintrust`
- [ ] Wrap agent calls with Braintrust tracing
- [ ] Export key metrics to Supabase for long-term storage

#### 4.2 A/B Testing Framework

- [ ] Extend `prompt_versions` with `traffic_percent` column
- [ ] Agent code routes % of traffic to test version
- [ ] Track performance metrics per version
- [ ] Promote winner to 100%

#### 4.3 Prompt Playground (Admin UI)

- [ ] Test prompt changes in sandbox
- [ ] Run against sample inputs
- [ ] See outputs before deploying
- [ ] Compare variants side-by-side

---

### Phase 5: Governance (L5) — Future

**Goal:** Full audit trail and approval workflows

- [ ] Prompt change approval workflow (require review)
- [ ] Audit log of who changed what, when
- [ ] Staged rollout (canary → 10% → 50% → 100%)
- [ ] Automatic rollback on quality regression
- [ ] Compliance reporting for AI governance

---

## Tool Comparison Summary

| Tool            | Free Tier                           | Best For            | Limitation      |
| --------------- | ----------------------------------- | ------------------- | --------------- |
| **Braintrust**  | 1M spans, 10k scores, 14d retention | Evals + iteration   | Short retention |
| **LangSmith**   | 5k traces/month                     | Tracing + debugging | Volume cap      |
| **W&B Prompts** | 1GB/month, 5GB storage              | Experiment tracking | Storage cap     |
| **Humanloop**   | 10k logs, 50 evals                  | Quick setup         | Sunsetting      |

**Recommendation:** Start with **Braintrust** for evals, export results to Supabase for long-term storage.

---

## Success Metrics

| Metric               | Current | Phase 1 | Phase 3   | Phase 4   |
| -------------------- | ------- | ------- | --------- | --------- |
| Prompts in DB        | ~50%    | 100%    | 100%      | 100%      |
| Agents in manifest   | 0       | 100%    | 100%      | 100%      |
| Eval coverage        | 0%      | 0%      | 80%       | 100%      |
| Avg time to iterate  | ~4h     | ~2h     | ~30m      | ~15m      |
| Regression detection | Manual  | Manual  | Automated | Automated |

---

## Immediate Next Steps (This PR)

1. [ ] Create `docs/agents/manifest.yaml`
2. [ ] Audit current `prompt_versions` table
3. [ ] Create `scripts/ci/check-prompt-coverage.js`
4. [ ] Add to CI workflow
5. [ ] Update `.windsurfrules` with new rules

---

## References

- [Braintrust Pricing](https://www.braintrust.dev/pricing)
- [LangSmith Docs](https://docs.smith.langchain.com/)
- [W&B Prompts](https://wandb.ai/site/prompts)
- KB-206: Staleness detection (prompted this analysis)
- KB-208: Audience single source of truth
- KB-209: Dynamic audience loading
