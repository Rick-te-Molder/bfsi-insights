-- ============================================================================
-- Refine audience scoring criteria to reduce Executive over-scoring
-- ============================================================================
-- Problem: Technical research papers (e.g., "LLM-based forecasting system")
-- score too high for Executive (60%) when they should score higher for
-- Engineer/Specialist. Executive criteria "high-level technology implications"
-- is too broad and captures academic/technical papers.
--
-- Changes:
-- 1. Executive: Tighten criteria to focus on business strategy, exclude pure technical/academic
-- 2. Engineer: Boost scoring for system architecture and technical frameworks
-- 3. Specialist: Clarify focus on operational/process improvements vs pure research

-- ============================================================================
-- 1. Update Executive audience criteria
-- ============================================================================
UPDATE kb_audience SET
  cares_about = 'Business strategy and competitive positioning
Market trends and industry disruption
Board-level decisions and governance
M&A, partnerships, market entry/exit
ROI, business cases, and financial impact
Regulatory changes with strategic implications
Technology adoption decisions (not implementation)',
  doesnt_care_about = 'Implementation details and code
Technical architecture specifics
Academic research methodology
Detailed operational procedures
Pure technical reports without business context
Research papers without clear business applications',
  scoring_guide = '9-10: Major strategic implications (regulatory change, market disruption, competitive threat, major technology shift affecting business model)
7-8: Valuable strategic insight (market analysis, case study with business outcomes, technology adoption trends with ROI)
5-6: Moderate relevance (interesting trend but not urgent, technology overview without business case)
3-4: Too technical, academic, or operational for executive audience (lacks business context)
1-2: Not relevant to executives (pure research, implementation guides, technical specifications)'
WHERE name = 'executive';

-- ============================================================================
-- 2. Update Engineer audience criteria
-- ============================================================================
UPDATE kb_audience SET
  cares_about = 'System architecture and design patterns
Technical frameworks and methodologies
API specifications and integration guides
Security implementation and vulnerabilities
Performance optimization and scalability
Code examples and implementation tutorials
DevOps, CI/CD, infrastructure patterns
Technical research with implementation potential',
  doesnt_care_about = 'High-level business strategy without technical depth
Marketing content and vendor pitches
Regulatory text without technical implications
Pure academic theory without practical application
Content for non-technical audiences',
  scoring_guide = '9-10: Critical security vulnerability, breakthrough technical approach, novel system architecture with clear implementation path
7-8: Solid technical guide, useful architecture pattern, technical research with code/implementation details, system design case study
5-6: Interesting technical concept but lacks implementation details, high-level technical overview
3-4: Too high-level or lacks technical depth (business-focused, lacks architecture/code)
1-2: Not technical content (pure business strategy, marketing)'
WHERE name = 'engineer';

-- ============================================================================
-- 3. Update Specialist audience criteria
-- ============================================================================
UPDATE kb_audience SET
  cares_about = 'Regulatory requirements and compliance frameworks
Risk management best practices and controls
Process improvements and operational efficiency
Vendor solutions and tool comparisons
Industry standards and certifications
Audit frameworks and governance
Practical implementation of regulations',
  doesnt_care_about = 'Pure academic theory without practical application
Deep technical implementation (code, APIs, architecture)
High-level strategy without actionable guidance
Content aimed at retail consumers
Research methodology without operational relevance',
  scoring_guide = '9-10: Critical compliance/regulatory update, must-implement guidance, major operational risk
7-8: Valuable best practice, relevant case study, useful framework, practical compliance guide
5-6: Interesting but narrow application, general industry trend
3-4: Too theoretical, too technical (lacks operational focus), or too strategic (lacks actionable steps)
1-2: Wrong audience or industry (pure research, pure technical, pure strategy)'
WHERE name = 'functional_specialist';

-- ============================================================================
-- 4. Add comment explaining the refinement
-- ============================================================================
COMMENT ON COLUMN kb_audience.scoring_guide IS 'Scoring rubric for LLM to evaluate content relevance (0.0-1.0 scale). Updated 2026-01-28 to reduce Executive over-scoring on technical/academic papers.';
