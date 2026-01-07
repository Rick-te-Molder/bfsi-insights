# KB-214: User Feedback Reinforcement System

## User Story

**As a** BFSI Insights operator,  
**I want** to capture, analyze, and learn from URLs my network shares that the system missed,  
**So that** the platform continuously improves until it outperforms human discovery.

---

## The Problem

> "In 100% of cases, BFSI Insights did not yet find articles my clients send me."

**Current State:**

- Coverage: ~30-40 sources (humans implicitly check hundreds)
- Recall: Estimated 0-5% of relevant content
- Discovery: Pull-based (cron), not event-driven
- Filtering: High precision, low recall (misses "grey area" content)
- Learning: Zero feedback loops

**The Gap:**
| Capability | Humans | BFSI Insights |
|------------|--------|---------------|
| Sources monitored | 100s (implicit) | ~40 |
| Discovery speed | Real-time (in-feed) | Daily batch |
| Dynamic content | Yes (browser) | No (RSS only) |
| Link following | Yes (clicks) | No |
| Feedback learning | Yes (memory) | No |

---

## The Vision

Every missed article is **free supervised training data** from domain experts.

```
Client sends link → Capture with rich context → Improver agent analyzes → System adapts → Measure improvement
```

**Target Timeline:**
| Timeframe | Recall Target | Status |
|-----------|---------------|--------|
| Now | ~5% | Baseline |
| 1-2 months | 30-40% | Noticeable improvement |
| 3-6 months | 60-70% | Competitive with humans |
| 6-12 months | 80%+ | **Outperforming humans** |

---

## Data Model: `missed_discovery`

```sql
CREATE TABLE missed_discovery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The URL itself
  url TEXT NOT NULL,
  url_norm TEXT NOT NULL,

  -- Submitter identity
  submitter_name TEXT,                  -- "John Smith", "Acme Corp"
  submitter_type TEXT,                  -- "client" | "internal" | "partner"
  submitter_audience TEXT,              -- "executive" | "functional_specialist" | "engineer" | "researcher"
  submitter_channel TEXT,               -- "email" | "slack" | "linkedin" | "meeting" | "whatsapp"
  submitted_at TIMESTAMPTZ DEFAULT now(),

  -- Why this matters (THE GOLD)
  why_valuable TEXT,                    -- "Exactly what our risk team needs" / "Board asked about this topic"
  submitter_urgency TEXT,               -- "fyi" | "important" | "critical"
  verbatim_comment TEXT,                -- Their exact words (often reveals intent)

  -- Content classification
  suggested_audiences TEXT[],           -- Which audiences should see this?
  suggested_topics TEXT[],              -- taxonomy topic codes
  suggested_industries TEXT[],          -- taxonomy industry codes
  suggested_geographies TEXT[],         -- taxonomy geography codes

  -- Source analysis (auto-filled)
  source_domain TEXT,                   -- "federalreserve.gov"
  source_type TEXT,                     -- "regulator" | "news" | "consultancy" | "vendor" | "research" | "social" | "unknown"
  existing_source_slug TEXT,            -- If we already track this domain

  -- Miss classification (filled by Improver agent)
  miss_category TEXT,                   -- See categories below
  miss_details JSONB,                   -- Detailed analysis

  -- Resolution tracking
  resolution_status TEXT DEFAULT 'pending',
  resolution_action TEXT,               -- What we did about it
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,

  -- Learning extraction (by Improver agent)
  improvement_suggestions JSONB,        -- Structured suggestions for system improvements
  contributed_to_source UUID,           -- FK to source if we added one
  contributed_to_pattern TEXT,          -- Pattern we added

  -- Impact metrics
  days_late INTEGER,                    -- Days between publish and submission
  retroactive_score INTEGER,            -- What would scorer give it now?

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Analytics indexes
CREATE INDEX idx_missed_source_domain ON missed_discovery(source_domain);
CREATE INDEX idx_missed_category ON missed_discovery(miss_category);
CREATE INDEX idx_missed_status ON missed_discovery(resolution_status);
CREATE INDEX idx_missed_submitter_audience ON missed_discovery(submitter_audience);
```

### Miss Categories

| Category             | Description                          | Fix Type           |
| -------------------- | ------------------------------------ | ------------------ |
| `source_not_tracked` | Domain not in our source table       | Add source         |
| `pattern_missing`    | Source tracked, but URL pattern not  | Add pattern        |
| `pattern_wrong`      | Pattern exists but didn't match      | Fix pattern        |
| `filter_rejected`    | Found but scored too low             | Tune scorer        |
| `crawl_failed`       | Technical failure (JS, paywall, etc) | Add rendering      |
| `too_slow`           | Found it, but days later             | Increase frequency |
| `link_not_followed`  | Was linked from page we crawled      | Add link following |
| `dynamic_content`    | JS-rendered, not in HTML             | Add Playwright     |

---

## Submission Flow: Capture Maximum Context

### UI: "Report Missed Article"

**Section 1: The URL**

```
┌─────────────────────────────────────────────────────────┐
│ URL *                                                    │
│ [https://example.com/article                          ] │
│                                                         │
│ ⚡ Auto-detected: federalreserve.gov (not tracked)      │
└─────────────────────────────────────────────────────────┘
```

**Section 2: Who Sent This?**

```
┌─────────────────────────────────────────────────────────┐
│ Submitter Name        [John Smith, Acme Corp         ]  │
│                                                         │
│ Their Role/Audience *                                   │
│ ○ Executive (C-suite, Board, VP)                        │
│ ○ Functional Specialist (Risk, Compliance, Finance)    │
│ ○ Engineer (IT, Dev, Data)                              │
│ ○ Researcher (Analyst, Academic)                        │
│                                                         │
│ Channel               [Email ▼]                         │
│                                                         │
│ Urgency               ○ FYI  ○ Important  ● Critical    │
└─────────────────────────────────────────────────────────┘
```

**Section 3: Why Was This Valuable? (THE GOLD)**

```
┌─────────────────────────────────────────────────────────┐
│ Why did they send this? What makes it valuable? *       │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Board meeting next week on AI regulation. This is   │ │
│ │ exactly the summary they need. Client said "this is │ │
│ │ the kind of content that makes us look smart."      │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 💡 Examples that help us learn:                         │
│    • "Board asked about this exact topic last week"     │
│    • "This is what our risk team has been searching for"│
│    • "Competitor mentioned this, we need to know too"   │
│    • "This vendor is on our shortlist"                  │
└─────────────────────────────────────────────────────────┘
```

**Section 4: Classification (Optional, Smart Defaults)**

```
┌─────────────────────────────────────────────────────────┐
│ Who should see this? (audiences)                        │
│ ☑ Executive  ☑ Functional Specialist  ☐ Engineer  ☐ Researcher │
│                                                         │
│ Topics        [AI/ML] [Regulation] [+]                  │
│ Industries    [Banking] [+]                             │
│ Geographies   [EU] [US] [+]                             │
└─────────────────────────────────────────────────────────┘
```

---

## The Improver Agent

A new agent that runs **daily** (or on-demand) to analyze missed discoveries and generate actionable improvements.

### Agent Pipeline

```
missed_discovery table
        ↓
   ┌─────────────┐
   │  Improver   │
   │    Agent    │
   └─────────────┘
        ↓
   ┌─────────────────────────────────────────┐
   │ 1. Classify miss (why did we miss it?)  │
   │ 2. Analyze patterns (what's common?)    │
   │ 3. Generate suggestions                 │
   │ 4. Prioritize by impact                 │
   └─────────────────────────────────────────┘
        ↓
   ┌─────────────────────────────────────────┐
   │ Output:                                 │
   │ • Source addition suggestions           │
   │ • Pattern improvements                  │
   │ • Scorer prompt adjustments             │
   │ • Taxonomy additions                    │
   │ • Crawl config changes                  │
   └─────────────────────────────────────────┘
```

### Improver Agent Responsibilities

#### 1. Miss Classification

For each unclassified missed_discovery:

- Determine `miss_category`
- Extract `miss_details`
- Calculate `days_late`
- Run retroactive scoring

#### 2. Pattern Analysis

Aggregate across misses to find:

- **Repeated domains**: "bis.org missed 5 times this month"
- **URL patterns**: "All misses from /publications/ path"
- **Content patterns**: "Misses often contain 'consultation' in title"
- **Timing patterns**: "Regulatory misses cluster around quarter-end"

#### 3. Improvement Suggestions

**Source Suggestions:**

```json
{
  "type": "add_source",
  "priority": "high",
  "domain": "bis.org",
  "evidence": {
    "miss_count": 5,
    "submitter_urgency_avg": "important",
    "audiences_affected": ["executive", "functional_specialist"],
    "why_valuable_themes": ["regulatory", "international standards"]
  },
  "suggested_config": {
    "name": "Bank for International Settlements",
    "type": "regulator",
    "poll_frequency": "6h",
    "patterns": ["/publ/", "/speeches/", "/press/"]
  }
}
```

**Scorer Prompt Suggestions:**

```json
{
  "type": "tune_scorer",
  "priority": "medium",
  "issue": "False negatives on consultation papers",
  "evidence": {
    "miss_count": 3,
    "avg_retroactive_score": 4.2,
    "expected_score": 8,
    "common_keywords": ["consultation", "feedback", "deadline"]
  },
  "suggested_prompt_addition": "Consultation papers and calls for feedback from regulators should score highly for functional_specialist audience, even if the title is generic."
}
```

**Taxonomy Suggestions:**

```json
{
  "type": "add_taxonomy",
  "priority": "low",
  "category": "topic",
  "suggestion": "operational-resilience",
  "evidence": {
    "miss_count": 2,
    "why_valuable_themes": ["DORA", "business continuity", "third-party risk"]
  }
}
```

### Improver Output: Weekly Improvement Report

```markdown
# 🔧 IMPROVEMENT REPORT - Week 50

## Summary

- 15 missed discoveries analyzed
- 8 improvement suggestions generated
- Estimated recall impact: +12%

## High Priority Actions

### 1. ADD SOURCE: bis.org

- **Misses**: 5 this month
- **Why valuable**: "International regulatory standards" (3x), "Basel updates" (2x)
- **Audiences affected**: Executive (4), Specialist (5)
- **Suggested patterns**: /publ/, /speeches/, /press/
- **[Create Source]** **[Dismiss]**

### 2. TUNE SCORER: Consultation papers

- **Issue**: Scoring 4-5 when should be 8+
- **Pattern**: Titles containing "consultation", "feedback requested"
- **Affected audiences**: Functional Specialist
- **[Edit Scorer Prompt]** **[Add to Golden Set]**

## Medium Priority

### 3. ADD PATTERN: federalreserve.gov/newsevents/testimony

- **Current patterns**: /newsevents/pressreleases/
- **Missing**: /newsevents/testimony/
- **[Add Pattern]**

### 4. INCREASE FREQUENCY: eba.europa.eu

- **Current**: Daily
- **Misses late by**: 3-4 days average
- **Suggested**: Every 6 hours
- **[Update Config]**

## Metrics Impact Forecast

If all high-priority actions implemented:

- Sources: 42 → 45 (+7%)
- Patterns: +3
- Estimated recall: 15% → 27%
```

---

## Measuring Success: The Path to Outperforming Humans

### Primary KPI: Client Surprise Rate

**Definition**: % of client-shared links that we hadn't already discovered

```
Current:  100% ████████████████████████████████████████ (every link is new)
Target:   <20% ████████                                  (we beat them 4/5 times)
North Star: <5% ██                                        (they come to US)
```

### Secondary Metrics

| Metric                   | Current | 3-Month Target | 6-Month Target |
| ------------------------ | ------- | -------------- | -------------- |
| **Recall**               | ~5%     | 40%            | 70%            |
| **Sources tracked**      | ~40     | 150            | 300            |
| **Avg days late**        | Unknown | <5 days        | <2 days        |
| **Miss → Resolution**    | N/A     | <7 days        | <3 days        |
| **Repeat domain misses** | N/A     | <3/month       | 0              |

### Tracking Dashboard

```
DISCOVERY PERFORMANCE - Last 30 Days
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Client Surprise Rate
Week 48: ████████████████████████████████████████ 100%
Week 49: ████████████████████████████████████     90%
Week 50: ██████████████████████████████           75%
Week 51: ████████████████████████                 60%

📈 Sources & Patterns
Sources:  42 ▲ (+8 this month)
Patterns: 156 ▲ (+23 this month)

⚡ Speed
Avg discovery lag: 4.2 days (↓ from 6.1)
Same-day discoveries: 23% (↑ from 12%)

🎯 By Audience (who are we failing?)
Executive:           ████████████████████ 80% miss rate
Functional Spec:     ████████████████     65% miss rate
Engineer:            ████████████         50% miss rate
Researcher:          ██████████           40% miss rate
```

---

## Why This Matters Strategically

### The Moat

> "Every competitor has AI. Not every competitor has a feedback loop from BFSI executives telling them exactly what they're missing."

Each missed discovery submission contains:

1. **A URL** (what to find)
2. **An audience** (who cares)
3. **A reason** (why it matters)
4. **Urgency** (how much they care)

This is **labeled training data** that money can't buy.

### The Flywheel

```
Better discovery → Fewer misses → More trust → More feedback → Better discovery
```

### The Goal

Not just to find articles. To **know what the network will want before they know they want it**.

---

## Implementation Phases

### Phase 1: Capture (Week 1-2)

- [ ] Create `missed_discovery` table with migration
- [ ] Add "Report Missed Article" page in admin
- [ ] Full submission flow with all fields
- [ ] Auto-extract domain and check existing sources
- [ ] List view of pending misses

### Phase 2: Analyze (Week 3-4)

- [ ] Build Improver agent scaffold
- [ ] Miss classification logic
- [ ] Retroactive scoring
- [ ] Days-late calculation
- [ ] Pattern aggregation

### Phase 3: Suggest (Week 5-6)

- [ ] Source addition suggestions
- [ ] Pattern improvement suggestions
- [ ] Scorer prompt suggestions
- [ ] Weekly improvement report generation

### Phase 4: Act (Week 7-8)

- [ ] One-click source addition from suggestion
- [ ] One-click pattern addition
- [ ] Scorer prompt A/B test integration
- [ ] Resolution workflow

### Phase 5: Measure (Ongoing)

- [ ] Client Surprise Rate dashboard
- [ ] Recall tracking
- [ ] By-audience performance
- [ ] Trend visualization

---

## Acceptance Criteria (Phase 1)

- [ ] User can submit missed URL with all context fields
- [ ] Submitter audience captured (executive/specialist/engineer/researcher)
- [ ] "Why was this valuable?" field required and prominent
- [ ] System auto-extracts domain and checks existing sources
- [ ] Submission stored in `missed_discovery` table
- [ ] Admin can view list of pending misses with filters
- [ ] Admin can mark miss as resolved with notes

---

## Appendix: Technical Gaps to Address

From analysis, the key technical gaps causing misses:

| Gap                   | Impact           | Fix                      |
| --------------------- | ---------------- | ------------------------ |
| **Source coverage**   | ~95% of misses   | Add 250+ sources         |
| **Dynamic content**   | ~30% of misses   | Add Playwright rendering |
| **Link following**    | ~20% of misses   | Crawl internal links     |
| **Poll frequency**    | Days late        | Per-source frequency     |
| **Filter strictness** | Grey area misses | Two-stage scoring        |

The feedback system captures evidence of these gaps systematically, enabling prioritized fixing.

---

_"The best time to find an article is when it's published. The second best time is when a client tells you about it. The worst time is never."_
