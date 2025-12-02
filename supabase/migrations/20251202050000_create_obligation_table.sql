-- ============================================================================
-- KB-135: Create obligation table for regulatory compliance
-- ============================================================================
-- Completes the Regulator → Regulation → Obligation hierarchy
-- ============================================================================

-- Create obligation table
CREATE TABLE IF NOT EXISTS obligation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  regulation_code TEXT REFERENCES regulation(code) ON DELETE CASCADE,
  category TEXT,  -- risk, reporting, security, governance, consumer-protection
  article_reference TEXT,  -- e.g., "Article 5-15"
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add comments
COMMENT ON TABLE obligation IS 'Compliance requirements per regulation (Regulator → Regulation → Obligation)';
COMMENT ON COLUMN obligation.code IS 'Unique slug, e.g., dora-ict-risk-management';
COMMENT ON COLUMN obligation.category IS 'Obligation category: risk, reporting, security, governance, consumer-protection';
COMMENT ON COLUMN obligation.article_reference IS 'Reference to regulation articles, e.g., Article 5-15';

-- Create junction table for publications
CREATE TABLE IF NOT EXISTS kb_publication_obligation (
  publication_id UUID REFERENCES kb_publication(id) ON DELETE CASCADE,
  obligation_code TEXT REFERENCES obligation(code) ON DELETE CASCADE,
  PRIMARY KEY (publication_id, obligation_code)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_obligation_regulation ON obligation(regulation_code);
CREATE INDEX IF NOT EXISTS idx_obligation_category ON obligation(category);
CREATE INDEX IF NOT EXISTS idx_pub_obligation_code ON kb_publication_obligation(obligation_code);

-- Enable RLS
ALTER TABLE obligation ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_publication_obligation ENABLE ROW LEVEL SECURITY;

-- RLS policies (read for all, write for service role)
CREATE POLICY "obligation_read_all" ON obligation FOR SELECT USING (true);
CREATE POLICY "obligation_write_service" ON obligation FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "pub_obligation_read_all" ON kb_publication_obligation FOR SELECT USING (true);
CREATE POLICY "pub_obligation_write_service" ON kb_publication_obligation FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- Seed initial obligations for major regulations
-- ============================================================================

-- DORA (Digital Operational Resilience Act) obligations
INSERT INTO obligation (code, name, description, regulation_code, category, article_reference, sort_order) VALUES
  ('dora-ict-risk-management', 'ICT Risk Management', 'Establish and maintain resilient ICT systems and tools to minimize the impact of ICT risk', 'dora', 'risk', 'Article 5-16', 1),
  ('dora-ict-incident-reporting', 'ICT Incident Reporting', 'Report major ICT-related incidents to competent authorities', 'dora', 'reporting', 'Article 17-23', 2),
  ('dora-digital-resilience-testing', 'Digital Resilience Testing', 'Conduct regular testing of ICT systems including threat-led penetration testing', 'dora', 'security', 'Article 24-27', 3),
  ('dora-third-party-risk', 'Third-Party ICT Risk', 'Manage ICT third-party risk including contractual arrangements with providers', 'dora', 'risk', 'Article 28-44', 4),
  ('dora-information-sharing', 'Information Sharing', 'Participate in cyber threat intelligence sharing arrangements', 'dora', 'governance', 'Article 45', 5)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  article_reference = EXCLUDED.article_reference;

-- GDPR (General Data Protection Regulation) obligations
INSERT INTO obligation (code, name, description, regulation_code, category, article_reference, sort_order) VALUES
  ('gdpr-lawful-processing', 'Lawful Processing', 'Process personal data only with valid legal basis', 'gdpr', 'governance', 'Article 6', 1),
  ('gdpr-data-subject-rights', 'Data Subject Rights', 'Facilitate rights including access, rectification, erasure, portability', 'gdpr', 'consumer-protection', 'Article 12-23', 2),
  ('gdpr-data-protection-officer', 'Data Protection Officer', 'Appoint DPO where required and ensure independence', 'gdpr', 'governance', 'Article 37-39', 3),
  ('gdpr-breach-notification', 'Breach Notification', 'Notify supervisory authority within 72 hours of becoming aware of breach', 'gdpr', 'reporting', 'Article 33-34', 4),
  ('gdpr-data-protection-impact', 'Data Protection Impact Assessment', 'Conduct DPIA for high-risk processing activities', 'gdpr', 'risk', 'Article 35', 5),
  ('gdpr-records-of-processing', 'Records of Processing', 'Maintain records of processing activities', 'gdpr', 'reporting', 'Article 30', 6),
  ('gdpr-security-measures', 'Security of Processing', 'Implement appropriate technical and organizational security measures', 'gdpr', 'security', 'Article 32', 7)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  article_reference = EXCLUDED.article_reference;

-- PSD2 (Payment Services Directive 2) obligations
INSERT INTO obligation (code, name, description, regulation_code, category, article_reference, sort_order) VALUES
  ('psd2-strong-customer-auth', 'Strong Customer Authentication', 'Apply SCA for electronic payments with limited exemptions', 'psd2', 'security', 'Article 97', 1),
  ('psd2-open-banking', 'Open Banking Access', 'Provide account access to licensed third-party providers', 'psd2', 'governance', 'Article 66-67', 2),
  ('psd2-fraud-reporting', 'Fraud Reporting', 'Report payment fraud statistics to competent authorities', 'psd2', 'reporting', 'Article 96', 3),
  ('psd2-incident-reporting', 'Security Incident Reporting', 'Report major operational or security incidents', 'psd2', 'reporting', 'Article 96', 4),
  ('psd2-customer-liability', 'Customer Liability Limits', 'Limit customer liability for unauthorized transactions', 'psd2', 'consumer-protection', 'Article 74', 5),
  ('psd2-complaint-handling', 'Complaint Handling', 'Establish procedures for handling customer complaints', 'psd2', 'consumer-protection', 'Article 99-101', 6)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  article_reference = EXCLUDED.article_reference;

-- Add obligation filter to ref_filter_config
INSERT INTO ref_filter_config (column_name, display_label, filter_type, sort_order, description) VALUES
  ('obligation', 'Obligation', 'multi-select', 75, 'Compliance requirement (e.g., ICT Risk Management, SCA)')
ON CONFLICT (column_name) DO UPDATE SET
  display_label = EXCLUDED.display_label,
  sort_order = EXCLUDED.sort_order,
  description = EXCLUDED.description;

-- Create view for obligation with regulation info
CREATE OR REPLACE VIEW obligation_pretty AS
SELECT 
  o.id,
  o.code,
  o.name,
  o.description,
  o.category,
  o.article_reference,
  o.regulation_code,
  r.title as regulation_title,
  r.domain,
  reg.code as regulator_code,
  reg.name as regulator_name
FROM obligation o
LEFT JOIN regulation r ON r.code = o.regulation_code
LEFT JOIN regulator reg ON reg.id = r.regulator_id
ORDER BY o.regulation_code, o.sort_order;
