-- ============================================================================
-- KB-198: Create taxonomy_config table for dynamic taxonomy management
-- ============================================================================
-- This table serves as a central registry for all tag categories, defining:
-- - How each taxonomy behaves (guardrail vs expandable vs scoring)
-- - Where data comes from (source tables)
-- - How it appears in the tagger prompt
-- - How it displays in the UI

-- ============================================================================
-- 1. Create the taxonomy_config table
-- ============================================================================

CREATE TABLE taxonomy_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  slug TEXT UNIQUE NOT NULL,           -- 'industry', 'vendor', 'persona_executive'
  display_name TEXT NOT NULL,          -- 'Industry', 'Vendor', 'Executive'
  display_name_plural TEXT,            -- 'Industries', 'Vendors', NULL for scoring
  display_order INT NOT NULL,          -- UI sort order
  
  -- Behavior type: how the tagger should handle this category
  -- 'guardrail': LLM must pick from closed list (validated)
  -- 'expandable': LLM extracts names, may propose new entries
  -- 'scoring': LLM assigns relevance score 0-1
  behavior_type TEXT NOT NULL CHECK (behavior_type IN ('guardrail', 'expandable', 'scoring')),
  
  -- Source configuration (for guardrail/expandable)
  source_table TEXT,                   -- 'bfsi_industry', 'ag_vendor', NULL for scoring
  source_code_column TEXT DEFAULT 'code',
  source_name_column TEXT DEFAULT 'name',
  is_hierarchical BOOLEAN DEFAULT FALSE,
  parent_code_column TEXT,             -- 'parent_code' for hierarchical taxonomies
  
  -- Publication linkage (junction table for many-to-many)
  junction_table TEXT,                 -- 'kb_publication_bfsi_industry'
  junction_code_column TEXT,           -- 'industry_code', 'vendor_id'
  
  -- Tagger configuration
  payload_field TEXT NOT NULL,         -- 'industry_codes', 'vendor_names', 'persona_scores.executive'
  include_list_in_prompt BOOLEAN DEFAULT TRUE,  -- Show available options to LLM
  prompt_section_title TEXT,           -- 'INDUSTRIES (hierarchical)', 'VENDORS (extract or match)'
  prompt_instruction TEXT,             -- Custom instruction for this category
  min_confidence REAL DEFAULT 0.3,     -- Minimum confidence to include in output
  
  -- UI configuration
  color TEXT DEFAULT 'neutral',        -- Tailwind color: 'blue', 'purple', 'emerald'
  show_confidence BOOLEAN DEFAULT FALSE,
  empty_placeholder TEXT DEFAULT '—',
  
  -- Scoring-specific (for behavior_type = 'scoring')
  score_parent_slug TEXT,              -- 'persona' groups executive/technical/compliance
  score_threshold REAL DEFAULT 0.5,    -- Min score to display in UI
  
  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for efficient lookups
CREATE INDEX idx_taxonomy_config_active ON taxonomy_config(is_active, display_order);
CREATE INDEX idx_taxonomy_config_behavior ON taxonomy_config(behavior_type) WHERE is_active;

-- ============================================================================
-- 2. Seed with current taxonomy configurations
-- ============================================================================

INSERT INTO taxonomy_config (
  slug, display_name, display_name_plural, display_order, behavior_type,
  source_table, is_hierarchical, parent_code_column,
  junction_table, junction_code_column,
  payload_field, include_list_in_prompt, prompt_section_title, prompt_instruction,
  color
) VALUES
-- Guardrail taxonomies (pick from closed list)
('industry', 'Industry', 'Industries', 1, 'guardrail',
 'bfsi_industry', TRUE, 'parent_code',
 'kb_publication_bfsi_industry', 'industry_code',
 'industry_codes', TRUE, 'INDUSTRIES (hierarchical - include L1 parent + L2/L3 specific)',
 'Pick the most specific industry codes. Include parent codes for hierarchy (e.g., if "retail-banking", also include "banking").',
 'blue'),

('topic', 'Topic', 'Topics', 2, 'guardrail',
 'bfsi_topic', TRUE, 'parent_code',
 'kb_publication_bfsi_topic', 'topic_code',
 'topic_codes', TRUE, 'TOPICS (hierarchical - include parent and sub-topics)',
 'Tag all relevant topics. Include parent codes for discoverability.',
 'purple'),

('geography', 'Geography', 'Geographies', 3, 'guardrail',
 'kb_geography', TRUE, 'parent_code',
 NULL, NULL,  -- Stored in payload, not junction table yet
 'geography_codes', TRUE, 'GEOGRAPHIES (pick all mentioned regions/countries)',
 'Include all geographic regions mentioned. Child regions automatically include parents.',
 'emerald'),

('process', 'Process', 'Processes', 4, 'guardrail',
 'bfsi_process_taxonomy', TRUE, 'parent_code',
 'kb_publication_bfsi_process', 'process_code',
 'process_codes', TRUE, 'BFSI PROCESSES (hierarchical - what business processes are discussed)',
 'Tag relevant business processes discussed in the content.',
 'amber'),

('regulator', 'Regulator', 'Regulators', 5, 'guardrail',
 'regulator', FALSE, NULL,
 'kb_publication_regulator', 'regulator_code',
 'regulator_codes', TRUE, 'REGULATORS (if regulatory content)',
 'Tag any regulatory bodies mentioned or implied.',
 'red'),

('regulation', 'Regulation', 'Regulations', 6, 'guardrail',
 'regulation', FALSE, NULL,
 'kb_publication_regulation', 'regulation_code',
 'regulation_codes', TRUE, 'REGULATIONS (if specific regulations mentioned)',
 'Tag specific regulations, directives, or standards mentioned.',
 'orange'),

-- Expandable taxonomies (extract names, may create new)
('vendor', 'Vendor', 'Vendors', 7, 'expandable',
 'ag_vendor', FALSE, NULL,
 'kb_publication_ag_vendor', 'vendor_id',
 'vendor_names', TRUE, 'VENDORS (extract or match existing)',
 'Extract AI/tech vendor names. Match to existing entries if possible, or propose new ones.',
 'cyan'),

('organization', 'Organization', 'Organizations', 8, 'expandable',
 'bfsi_organization', FALSE, NULL,
 'kb_publication_bfsi_organization', 'organization_id',
 'organization_names', TRUE, 'BFSI ORGANIZATIONS (extract or match existing)',
 'Extract bank, insurer, or asset manager names. Match to existing entries if possible.',
 'pink');

-- Scoring taxonomies (persona relevance)
INSERT INTO taxonomy_config (
  slug, display_name, display_order, behavior_type,
  payload_field, include_list_in_prompt, prompt_section_title, prompt_instruction,
  color, score_parent_slug, score_threshold, show_confidence
) VALUES
('persona_executive', 'Executive', 9, 'scoring',
 'persona_scores.executive', FALSE, NULL,
 'C-suite, strategy leaders (interested in: business impact, market trends, competitive advantage)',
 'violet', 'persona', 0.5, TRUE),

('persona_technical', 'Technical', 10, 'scoring',
 'persona_scores.technical', FALSE, NULL,
 'Engineers, architects, IT leaders (interested in: implementation, architecture, technical details)',
 'violet', 'persona', 0.5, TRUE),

('persona_compliance', 'Compliance', 11, 'scoring',
 'persona_scores.compliance', FALSE, NULL,
 'Risk, compliance, legal (interested in: regulations, risk management, audit, governance)',
 'violet', 'persona', 0.5, TRUE);

-- ============================================================================
-- 3. Add RLS policies
-- ============================================================================

ALTER TABLE taxonomy_config ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "taxonomy_config_select" ON taxonomy_config
  FOR SELECT TO authenticated
  USING (true);

-- Allow service role full access
CREATE POLICY "taxonomy_config_service" ON taxonomy_config
  FOR ALL TO service_role
  USING (true);

-- Grant permissions
GRANT SELECT ON taxonomy_config TO anon, authenticated;
GRANT ALL ON taxonomy_config TO service_role;

-- ============================================================================
-- 4. Add trigger for updated_at
-- ============================================================================

-- Create the function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER taxonomy_config_updated_at
  BEFORE UPDATE ON taxonomy_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. Add comments
-- ============================================================================

COMMENT ON TABLE taxonomy_config IS 'Central registry for all tag categories used by tagger, UI, and approve functions';
COMMENT ON COLUMN taxonomy_config.behavior_type IS 'guardrail=pick from list, expandable=extract names, scoring=assign 0-1 score';
COMMENT ON COLUMN taxonomy_config.include_list_in_prompt IS 'Whether to show available options to LLM (TRUE for guardrails, TRUE for expandable to enable matching)';
COMMENT ON COLUMN taxonomy_config.payload_field IS 'Field path in ingestion_queue.payload (e.g., industry_codes, persona_scores.executive)';
