-- ============================================================================
-- Restructure kb_audience as single source of truth for audience definitions
-- ============================================================================
-- Changes:
-- 1. Add UUID primary key (id)
-- 2. Rename 'value' to 'name' (keep as unique slug)
-- 3. Add prompt content columns: cares_about, doesnt_care_about, scoring_guide
-- 4. Update foreign key references
-- ============================================================================

-- 1. Add new columns
ALTER TABLE kb_audience 
  ADD COLUMN id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN cares_about TEXT,
  ADD COLUMN doesnt_care_about TEXT,
  ADD COLUMN scoring_guide TEXT;

-- 2. Generate UUIDs for existing rows
UPDATE kb_audience SET id = gen_random_uuid() WHERE id IS NULL;

-- 3. Rename 'value' to 'name'
ALTER TABLE kb_audience RENAME COLUMN value TO name;

-- 4. Drop FK that depends on the old PK, drop old PK, add new PK on id
-- Note: Original constraint was named 'ref_role_pkey' (from before table rename)
ALTER TABLE kb_source DROP CONSTRAINT kb_source_primary_audience_fkey;
ALTER TABLE kb_audience DROP CONSTRAINT ref_role_pkey;
ALTER TABLE kb_audience ADD PRIMARY KEY (id);
ALTER TABLE kb_audience ADD CONSTRAINT kb_audience_name_unique UNIQUE (name);

-- 5. Recreate FK referencing the unique name column
ALTER TABLE kb_source ADD CONSTRAINT kb_source_primary_audience_fkey 
  FOREIGN KEY (primary_audience) REFERENCES kb_audience(name);

-- 6. Make id NOT NULL
ALTER TABLE kb_audience ALTER COLUMN id SET NOT NULL;

-- 7. Seed prompt content for each audience
UPDATE kb_audience SET
  cares_about = 'Strategy and market trends
Competitive advantage and business impact
Board-level decisions and governance
M&A, partnerships, market entry
High-level technology implications (not implementation)
ROI and business cases',
  doesnt_care_about = 'Implementation details and code
Technical architecture specifics
Detailed methodology
Day-to-day operational procedures',
  scoring_guide = '9-10: Major strategic implications (regulatory change, market disruption, competitive threat)
7-8: Valuable strategic insight (trend analysis, case study with business outcomes)
5-6: Moderate relevance (interesting but not urgent)
3-4: Too operational or technical for executive audience
1-2: Not relevant to executives'
WHERE name = 'executive';

UPDATE kb_audience SET
  cares_about = 'Regulatory requirements and compliance frameworks
Risk management best practices
Process improvements and operational efficiency
Vendor solutions and tool comparisons
Industry standards and certifications
Audit and control frameworks',
  doesnt_care_about = 'Pure academic theory without practical application
Deep technical implementation details
High-level strategy without actionable guidance
Content aimed at retail consumers',
  scoring_guide = '9-10: Critical compliance/regulatory update, must-implement guidance
7-8: Valuable best practice, relevant case study, useful framework
5-6: Interesting but narrow application
3-4: Too theoretical or too technical
1-2: Wrong audience or industry'
WHERE name = 'functional_specialist';

UPDATE kb_audience SET
  cares_about = 'Technical architecture and design patterns
API specifications and integration guides
Security implementation and vulnerabilities
Performance optimization techniques
Code examples and implementation tutorials
DevOps, CI/CD, infrastructure as code',
  doesnt_care_about = 'High-level business strategy without technical depth
Marketing content and vendor pitches
Regulatory text without technical implications
Content for non-technical audiences',
  scoring_guide = '9-10: Critical security vulnerability, breakthrough technical approach
7-8: Solid technical guide, useful architecture pattern, good code examples
5-6: Interesting but not immediately applicable
3-4: Too high-level or lacks technical depth
1-2: Not technical content'
WHERE name = 'engineer';

UPDATE kb_audience SET
  cares_about = 'Research methodology and data analysis
Peer-reviewed findings and academic papers
Theoretical frameworks and models
Statistical analysis and empirical evidence
Literature reviews and meta-analyses
Novel approaches and experimental results',
  doesnt_care_about = 'Marketing and promotional content
Superficial overviews without methodology
Opinion pieces without data backing
Practitioner guides without research basis',
  scoring_guide = '9-10: Groundbreaking research, highly cited potential, novel methodology
7-8: Solid academic contribution, good methodology, useful findings
5-6: Incremental research, limited novelty
3-4: Weak methodology or unsubstantiated claims
1-2: Not research content'
WHERE name = 'researcher';

-- 8. Add comments
COMMENT ON TABLE kb_audience IS 'Target audience definitions with prompt content for discovery scoring. Single source of truth for audience-specific LLM instructions.';
COMMENT ON COLUMN kb_audience.id IS 'UUID primary key';
COMMENT ON COLUMN kb_audience.name IS 'Unique slug identifier (executive, functional_specialist, engineer, researcher)';
COMMENT ON COLUMN kb_audience.label IS 'Human-readable display name';
COMMENT ON COLUMN kb_audience.description IS 'Brief description of who this audience is';
COMMENT ON COLUMN kb_audience.cares_about IS 'What this audience cares about - used in LLM prompts';
COMMENT ON COLUMN kb_audience.doesnt_care_about IS 'What this audience does not care about - used in LLM prompts';
COMMENT ON COLUMN kb_audience.scoring_guide IS 'Scoring rubric for this audience - used in LLM prompts';
COMMENT ON COLUMN kb_audience.sort_order IS 'Display order in UI';
