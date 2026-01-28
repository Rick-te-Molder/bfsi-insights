# Audience Scoring Criteria Refinement

## Problem Statement

Technical research papers (e.g., "AIA Forecaster: Technical Report - LLM-Based System for...") were scoring too high for Executive audience (60%) when they should score higher for Engineer/Specialist.

**Example case:**

- Title: "AIA Forecaster: Technical Report - LLM-Based System for..."
- Content: LLM-based forecasting, statistical calibration, benchmark validation
- Current scores: Executive 60%, Researcher 90%
- Expected scores: Executive <50%, Engineer 70-80%, Researcher 90%

## Root Cause

Executive criteria "high-level technology implications (not implementation)" was too broad and captured academic/technical papers that discuss technology systems.

## Solution

### Executive - Tightened Criteria

**Before:**

- Cares about: "High-level technology implications (not implementation)"
- Scoring 7-8: "Valuable strategic insight (trend analysis, case study with business outcomes)"

**After:**

- Cares about: "Technology adoption decisions (not implementation)"
- Doesn't care about: "Pure technical reports without business context, Research papers without clear business applications"
- Scoring 7-8: "Valuable strategic insight (market analysis, case study with business outcomes, **technology adoption trends with ROI**)"
- Scoring 3-4: "Too technical, academic, or operational for executive audience **(lacks business context)**"

**Key change:** Added explicit exclusion of "pure technical reports" and "research papers without clear business applications". Scoring guide now requires business context/ROI for high scores.

### Engineer - Expanded Criteria

**Before:**

- Cares about: Technical architecture, APIs, code examples
- Scoring 7-8: "Solid technical guide, useful architecture pattern, good code examples"

**After:**

- Cares about: "System architecture and design patterns, **Technical frameworks and methodologies**, **Technical research with implementation potential**"
- Scoring 7-8: "Solid technical guide, useful architecture pattern, **technical research with code/implementation details, system design case study**"

**Key change:** Added "technical research with implementation potential" and "system design case study" to capture papers like "LLM-based forecasting system" that describe technical architectures even without full code examples.

### Specialist - Clarified Criteria

**Before:**

- Doesn't care about: "Pure academic theory without practical application"

**After:**

- Doesn't care about: "Pure academic theory without practical application, **Research methodology without operational relevance**"
- Scoring 3-4: "Too theoretical, **too technical (lacks operational focus)**, or too strategic (lacks actionable steps)"

**Key change:** Explicitly excludes pure technical/research content that lacks operational/compliance focus.

## Expected Impact

### Example: "AIA Forecaster: Technical Report"

**Before (current):**

- Executive: 60% (captured by "high-level technology implications")
- Researcher: 90% (correct - methodology, validation)
- Engineer: ~40% (lacks code examples)
- Specialist: ~30% (not compliance-focused)

**After (expected):**

- Executive: 30-40% (lacks business context, ROI, or strategic implications)
- Researcher: 90% (unchanged - still strong methodology)
- Engineer: 70-80% (now captures "technical research with implementation potential" and "system design")
- Specialist: 30-40% (unchanged - not operational/compliance)

### Example: "McKinsey: GenAI in Banking - $340B Opportunity"

**Before and After (should remain high Executive):**

- Executive: 80-90% (strategic insight, business outcomes, ROI)
- Researcher: 40-50% (not academic research)
- Engineer: 30-40% (lacks technical depth)
- Specialist: 50-60% (operational implications)

## Migration

File: `infra/supabase/migrations/2026/20260128160000_refine_audience_scoring_criteria.sql`

Updates `kb_audience` table `cares_about`, `doesnt_care_about`, and `scoring_guide` columns for:

- `executive`
- `engineer`
- `functional_specialist`

## Testing

After applying this migration:

1. Re-score existing items using the scorer agent with updated criteria
2. Compare before/after scores for sample technical papers vs business strategy content
3. Validate that technical research papers now score higher for Engineer than Executive

## Rollout

1. Apply migration to local/staging
2. Test scorer agent with updated criteria
3. Review sample scores for validation
4. Apply to production
5. Consider bulk re-scoring of recent items (last 30 days) to update audience scores
