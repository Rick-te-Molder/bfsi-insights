-- Writing Rules Table
-- Maintainable plain English guidelines for content generation

CREATE TABLE IF NOT EXISTS writing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL, -- e.g., 'plain_english', 'structure', 'tone', 'formatting'
  rule_name TEXT NOT NULL,
  rule_text TEXT NOT NULL,
  examples TEXT, -- Good/bad examples
  priority INTEGER DEFAULT 50, -- Higher = more important
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create unique constraint on category + rule_name
CREATE UNIQUE INDEX IF NOT EXISTS idx_writing_rules_unique ON writing_rules(category, rule_name);

-- Enable RLS
ALTER TABLE writing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on writing_rules" ON writing_rules
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed with Plain English rules
INSERT INTO writing_rules (category, rule_name, rule_text, examples, priority) VALUES

-- Plain English Fundamentals
('plain_english', 'short_sentences', 
 'Keep sentences under 25 words. One idea per sentence. Break long sentences into shorter ones.',
 'BAD: "The implementation of the new regulatory framework, which was announced by the European Commission last month, will require financial institutions to update their compliance systems by Q3 2025, although some exceptions may apply."
GOOD: "The European Commission announced a new regulatory framework last month. Financial institutions must update their compliance systems by Q3 2025. Some exceptions may apply."',
 100),

('plain_english', 'active_voice',
 'Use active voice. Say who does what. Avoid passive constructions.',
 'BAD: "The report was published by McKinsey."
GOOD: "McKinsey published the report."',
 95),

('plain_english', 'concrete_numbers',
 'Use specific numbers, not vague quantities. Include units and timeframes.',
 'BAD: "Significant cost savings were achieved."
GOOD: "The bank reduced operational costs by 23% (£4.2M annually) within 18 months."',
 90),

('plain_english', 'avoid_jargon',
 'Explain technical terms on first use. Prefer common words over jargon.',
 'BAD: "Leverage synergies to optimize the value chain."
GOOD: "Work together to reduce costs across the supply chain."',
 85),

('plain_english', 'no_nominalisations',
 'Use verbs instead of noun forms. "Decide" not "make a decision". "Analyse" not "conduct an analysis".',
 'BAD: "The implementation of the solution..."
GOOD: "Implementing the solution..." or "They implemented..."',
 80),

('plain_english', 'front_load_key_info',
 'Put the most important information first. Lead with the conclusion or key finding.',
 'BAD: "After extensive research spanning 18 months and involving 200 institutions, we found that AI reduces fraud by 40%."
GOOD: "AI reduces fraud by 40%. This finding comes from 18 months of research across 200 institutions."',
 75),

-- Structure Rules
('structure', 'bullet_points',
 'Use bullet points for lists of 3+ items. Start each bullet with a verb or key noun.',
 'Format: "Key findings:\n• Fraud detection improved 40%\n• Processing time reduced by 3 days\n• Customer satisfaction up 15 points"',
 70),

('structure', 'evidence_based',
 'Every claim must have evidence. Include source, date, and methodology where available.',
 'BAD: "AI is transforming insurance."
GOOD: "AI is transforming insurance claims processing—Allianz reported 60% faster claims resolution using their AI system (2024 Annual Report)."',
 90),

('structure', 'quantify_impact',
 'Quantify business impact in terms of: cost savings (£/%), time saved, risk reduced, revenue increased.',
 'Template: "[Metric] improved by [X%] ([£Y] annually) for [organisation] in [timeframe]."',
 85),

-- Tone Rules
('tone', 'professional_neutral',
 'Maintain professional, neutral tone. No marketing language or hype.',
 'BAD: "This groundbreaking, revolutionary approach..."
GOOD: "This approach differs from traditional methods by..."',
 80),

('tone', 'actionable',
 'Make insights actionable. What should the reader do with this information?',
 'Template: "BFSI firms should consider [action] because [reason] to achieve [outcome]."',
 75),

-- BFSI-Specific Rules
('bfsi', 'sector_specificity',
 'Always specify which BFSI sector(s) the insight applies to. Be precise: L1 (Banking/Insurance/FS), L2 (Retail Banking/Life Insurance), L3 (Mortgages/Pensions).',
 'BAD: "This applies to financial services."
GOOD: "This applies specifically to retail banks processing mortgage applications."',
 90),

('bfsi', 'regulatory_context',
 'Mention relevant regulations when applicable (GDPR, PSD2, DORA, Solvency II, MiFID II, etc.).',
 'Example: "Under DORA requirements effective January 2025, banks must implement..."',
 85),

('bfsi', 'vendor_identification',
 'Name vendors, technology providers, and consultancies mentioned. Include their role.',
 'Format: "[Vendor] provides [product/service] for [use case]."',
 70)

ON CONFLICT (category, rule_name) DO UPDATE SET
  rule_text = EXCLUDED.rule_text,
  examples = EXCLUDED.examples,
  priority = EXCLUDED.priority,
  updated_at = now();

COMMENT ON TABLE writing_rules IS 'Maintainable plain English and content guidelines for AI-generated summaries';
