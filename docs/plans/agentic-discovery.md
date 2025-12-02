# Agentic Discovery System - Design Document

**Issue**: KB-155
**Status**: Draft
**Author**: Cascade + User
**Date**: 2025-12-02

## 1. Problem Statement

### Current State

The discovery agent (`discover.js`) is a **rule-based RSS scraper** that:

- Fetches from RSS feeds and sitemaps
- Applies keyword matching from taxonomy labels
- Applies regex exclusion patterns
- Skips 13 premium sources entirely
- Has no quality or relevance scoring

### Pain Points

| Issue                         | Impact                                                      |
| ----------------------------- | ----------------------------------------------------------- |
| **Keyword matching is noisy** | arXiv papers with "banking" may be irrelevant to executives |
| **Premium sources skipped**   | McKinsey, BCG, Deloitte content never discovered            |
| **No impact scoring**         | Academic papers treated equal regardless of citations       |
| **No classic papers**         | Foundational works like "Attention is All You Need" missed  |
| **No executive relevance**    | Peer-reviewed ≠ executive-relevant                          |
| **Rule-based = brittle**      | Can't adapt to new content patterns                         |

### Target Audience

**BFSI executives and consultants** who need:

- Actionable insights, not academic minutiae
- High-impact research with practical implications
- Regulatory and competitive intelligence
- Technology trends affecting their industry

---

## 2. Vision: Agentic Discovery

Transform discovery from a **rule-based scraper** into an **intelligent agent** that:

1. **Understands Intent**: Knows what executives care about
2. **Evaluates Quality**: Scores content on multiple dimensions
3. **Handles Premium**: Intelligently processes paywalled content
4. **Finds Classics**: Proactively discovers foundational papers
5. **Learns**: Improves based on approval/rejection patterns

---

## 3. Architecture

### 3.1 Current Flow (Rule-Based)

```
RSS Feed → Keyword Match → Exclusion Filter → Queue
```

### 3.2 Proposed Flow (Agentic)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DISCOVERY ORCHESTRATOR                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐                │
│  │ RSS Scanner │   │Citation API │   │ Premium     │                │
│  │ (existing)  │   │ (new)       │   │ Handler     │                │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘                │
│         │                 │                 │                        │
│         └────────────┬────┴────────────────┘                        │
│                      ▼                                               │
│              ┌──────────────┐                                        │
│              │  CANDIDATE   │                                        │
│              │    POOL      │                                        │
│              └──────┬───────┘                                        │
│                     ▼                                                │
│         ┌───────────────────────┐                                    │
│         │   RELEVANCE AGENT     │  ← LLM-powered                    │
│         │   (executive focus)   │                                    │
│         └───────────┬───────────┘                                    │
│                     ▼                                                │
│         ┌───────────────────────┐                                    │
│         │   QUALITY SCORER      │                                    │
│         │   (impact, authority) │                                    │
│         └───────────┬───────────┘                                    │
│                     ▼                                                │
│         ┌───────────────────────┐                                    │
│         │   DEDUP & RANK        │                                    │
│         └───────────┬───────────┘                                    │
│                     ▼                                                │
│              ┌──────────────┐                                        │
│              │    QUEUE     │                                        │
│              │ (with score) │                                        │
│              └──────────────┘                                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Components

### 4.1 Relevance Agent (LLM-Powered)

**Purpose**: Determine if content is relevant and valuable for BFSI executives.

**Prompt Strategy**:

```
You are evaluating content for BFSI executives (Banking, Financial Services, Insurance).

Target audience:
- C-suite executives (CEO, CTO, CDO, CRO)
- Senior consultants and advisors
- Strategy and transformation leaders

They care about:
- AI/ML applications with business impact
- Regulatory changes and compliance
- Competitive intelligence and market shifts
- Technology adoption and digital transformation
- Risk management and operational efficiency

They DON'T care about:
- Pure academic theory without business application
- Highly technical implementation details
- Research relevant only to PhDs
- Content for retail consumers

Given this title and abstract, score relevance 1-10 and explain briefly.
```

**Input**: Title, abstract/description, source
**Output**:

```json
{
  "relevance_score": 7,
  "executive_summary": "Why this matters to executives",
  "skip_reason": null | "Too academic" | "Wrong industry"
}
```

### 4.2 Quality Scorer

**Multi-dimensional scoring**:

| Dimension            | Weight | Source                |
| -------------------- | ------ | --------------------- |
| **Recency**          | 15%    | Publication date      |
| **Citations**        | 25%    | Semantic Scholar API  |
| **Author Authority** | 20%    | h-index, institution  |
| **Source Tier**      | 20%    | Our kb_source.tier    |
| **Relevance**        | 20%    | Relevance Agent score |

**Formula**:

```
final_score = (recency * 0.15) + (citations * 0.25) + (authority * 0.20)
            + (source_tier * 0.20) + (relevance * 0.20)
```

**Thresholds**:

- Score ≥ 7.0 → Auto-enrich (high confidence)
- Score 4.0-6.9 → Queue for review
- Score < 4.0 → Skip with reason logged

### 4.3 Citation & Impact API

**Primary**: Semantic Scholar API (free, comprehensive)

```
GET https://api.semanticscholar.org/graph/v1/paper/search
?query={title}
&fields=citationCount,influentialCitationCount,authors,year
```

**Fallback**: OpenAlex API (open access)

**Data captured**:

- `citation_count`: Total citations
- `influential_citations`: Citations in influential papers
- `h_index_max`: Highest h-index among authors
- `institution_rank`: Top institution ranking (if available)

### 4.4 Premium Source Handler

**Strategy by source type**:

| Source                      | Strategy                                       |
| --------------------------- | ---------------------------------------------- |
| **McKinsey, BCG, Deloitte** | Scrape public summaries + landing pages        |
| **FT, Economist**           | Use RSS for headlines, flag for manual review  |
| **ECB, Fed, BIS**           | Full access (public) - already works           |
| **arXiv**                   | Full access (open) - needs relevance filtering |

**Premium handling modes**:

1. `headline_only`: Capture title + snippet, mark as premium
2. `landing_page`: Scrape public preview
3. `manual_queue`: Queue for human curation
4. `api_access`: Use official API (if available)

### 4.5 Classic Papers Discovery

**Approach**: Periodic sweep for foundational papers

**Curated seed list** (stored in database):

```sql
CREATE TABLE classic_papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  arxiv_id TEXT,
  doi TEXT,
  year INTEGER,
  category TEXT, -- 'llm', 'transformer', 'fintech', etc.
  importance_note TEXT,
  discovered BOOLEAN DEFAULT false
);
```

**Initial seeds**:

- "Attention Is All You Need" (2017) - Transformers
- "BERT: Pre-training of Deep Bidirectional Transformers" (2018)
- "GPT-3: Language Models are Few-Shot Learners" (2020)
- "High-Frequency Trading" - foundational papers
- "Basel III" - regulatory frameworks
- "Digital Transformation in Banking" - seminal works

**Discovery modes**:

1. **Seed expansion**: Find papers that cite classics
2. **Reverse search**: Find papers cited by approved publications
3. **Author follow**: Track prolific authors in BFSI+AI

---

## 5. Database Changes

### 5.1 Enhanced ingestion_queue

```sql
ALTER TABLE ingestion_queue ADD COLUMN IF NOT EXISTS
  relevance_score DECIMAL(3,1),         -- LLM relevance score
  quality_score DECIMAL(3,1),           -- Composite quality score
  citation_count INTEGER,               -- From Semantic Scholar
  author_authority DECIMAL(3,1),        -- Computed h-index score
  discovery_reason TEXT,                -- Why this was discovered
  skip_reason TEXT;                     -- Why this was skipped (if applicable)
```

### 5.2 New: discovery_metrics

```sql
CREATE TABLE discovery_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date DATE NOT NULL,
  source_slug TEXT REFERENCES kb_source(slug),
  candidates_found INTEGER,
  passed_relevance INTEGER,
  passed_quality INTEGER,
  queued INTEGER,
  avg_relevance_score DECIMAL(3,1),
  avg_quality_score DECIMAL(3,1),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 6. Implementation Phases

### Phase 1: LLM Relevance Agent (1-2 days) - Month 1 Trial

- [ ] Add relevance agent using GPT-4o-mini (~$10/month)
- [ ] Score every candidate before queue insertion
- [ ] Log skip reasons to database
- [ ] Show pending items count in review UI
- [ ] **Goal**: Validate that LLM scoring improves approval rate

### Phase 2: Hybrid Pipeline (2-3 days) - Cost Optimization

- [ ] Build reference embedding from approved publications
- [ ] Implement embedding-based pre-filter
- [ ] Only LLM-score top 20% (high similarity candidates)
- [ ] Add caching layer for embeddings
- [ ] **Goal**: Reduce costs to ~$1/month

### Phase 3: Quality Scoring (3-5 days)

- [ ] Integrate Semantic Scholar API for citations
- [ ] Implement multi-factor scoring (citations, h-index, recency)
- [ ] Add score-based auto-skip threshold
- [ ] **Goal**: Prioritize high-impact content

### Phase 4: Premium Handling (3-5 days)

- [ ] Implement headline_only mode for paywalled sources
- [ ] Add landing page scraper for consultancy sites
- [ ] Create manual curation queue for premium content
- [ ] **Goal**: 50% coverage of premium sources

### Phase 5: Classic Papers (2-3 days)

- [ ] Create classic_papers seed table
- [ ] Implement periodic classic sweep
- [ ] Add citation-based expansion
- [ ] **Goal**: 50+ foundational papers discovered

### Phase 6: Learning Loop (5+ days)

- [ ] Track approval/rejection patterns
- [ ] Update reference embedding with new approvals
- [ ] Implement source-level trust scores
- [ ] **Goal**: Self-improving system

---

## 7. Success Metrics

| Metric                  | Current | Target           |
| ----------------------- | ------- | ---------------- |
| **Approval rate**       | ~60%    | ≥85%             |
| **Executive relevance** | Unknown | ≥8/10 avg        |
| **Premium coverage**    | 0%      | ≥50%             |
| **Classic papers**      | 0       | 50+ foundational |
| **False positives**     | High    | <5%              |
| **Discovery latency**   | Hours   | <30 min          |

---

## 8. API Costs

### Option A: Full LLM (Month 1 trial)

| Service                | Cost         | Monthly Estimate      |
| ---------------------- | ------------ | --------------------- |
| **Semantic Scholar**   | Free         | $0                    |
| **OpenAI GPT-4o-mini** | ~$0.003/call | ~$9 (3000 candidates) |
| **OpenAlex**           | Free         | $0                    |
| **Total**              |              | ~$10/month            |

### Option B: Hybrid Pipeline (Production - 10x cheaper)

```
3000 candidates
    ↓ Rule filter (free) → 1500 remain
    ↓ Embedding similarity ($0.15) → 300 high-relevance
    ↓ LLM scoring ($0.90) → Queue with scores
```

| Step                 | Volume | Cost/unit | Total            |
| -------------------- | ------ | --------- | ---------------- |
| **Rule pre-filter**  | 3000   | $0        | $0               |
| **Embeddings**       | 1500   | $0.0001   | $0.15            |
| **GPT-4o-mini**      | 300    | $0.003    | $0.90            |
| **Semantic Scholar** | 300    | $0        | $0               |
| **Total**            |        |           | **~$1.05/month** |

### How Embeddings Work

1. Create reference embedding from approved publications
2. Embed each candidate title+abstract
3. Cosine similarity > 0.7 → passes to LLM
4. Below threshold → auto-skip with reason

### Caching Strategy

- Cache embeddings by source pattern
- Cache LLM decisions for similar titles
- Reuse reference embedding (compute once)

---

## 9. Risks & Mitigations

| Risk                                   | Impact | Mitigation                            |
| -------------------------------------- | ------ | ------------------------------------- |
| LLM costs escalate                     | Medium | Batch processing, caching             |
| Semantic Scholar rate limits           | Low    | Implement backoff, cache              |
| Premium scrapers blocked               | Medium | Rotate user agents, use APIs          |
| False negatives (good content skipped) | High   | Low threshold initially, review skips |

---

## 10. Open Questions

1. **Approval feedback loop**: How to weight historical approvals/rejections?
2. **Author tracking**: Should we follow specific researchers?
3. **Competitive intelligence**: Prioritize content mentioning competitors?
4. **Language support**: Handle non-English sources?

---

## Next Steps

1. Review and refine this document
2. Create Linear issues for each phase
3. Start with Phase 1 (Relevance Agent)
4. Measure impact before proceeding to Phase 2
