-- ============================================================================
-- KB-155: Add classic_papers seed table
-- ============================================================================
-- Stores foundational BFSI papers that should be in the knowledge base
-- Used for citation-based discovery expansion
-- ============================================================================

CREATE TABLE IF NOT EXISTS classic_papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Paper identification
  title TEXT NOT NULL,
  authors TEXT[], -- Array of author names
  year INTEGER,
  
  -- External IDs for lookup
  doi TEXT,
  arxiv_id TEXT,
  semantic_scholar_id TEXT,
  
  -- Categorization
  category TEXT NOT NULL, -- e.g., 'risk', 'regulation', 'ai-ml', 'strategy'
  subcategory TEXT,
  
  -- Why this is a classic
  significance TEXT NOT NULL, -- Brief description of why it matters
  executive_relevance TEXT, -- Why executives should know about it
  
  -- Discovery status
  discovered BOOLEAN DEFAULT FALSE, -- Has been added to ingestion_queue
  discovered_at TIMESTAMPTZ,
  publication_id UUID REFERENCES kb_publication(id),
  
  -- Metadata
  citation_count INTEGER, -- From Semantic Scholar
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for undiscovered papers
CREATE INDEX IF NOT EXISTS idx_classic_papers_undiscovered 
ON classic_papers(discovered) WHERE discovered = FALSE;

-- Index for category queries
CREATE INDEX IF NOT EXISTS idx_classic_papers_category 
ON classic_papers(category);

-- Comments
COMMENT ON TABLE classic_papers IS 'Foundational BFSI papers for citation-based discovery expansion';
COMMENT ON COLUMN classic_papers.significance IS 'Why this paper is considered a classic/foundational';
COMMENT ON COLUMN classic_papers.discovered IS 'Whether this paper has been added to the knowledge base';

-- ============================================================================
-- Seed with foundational papers
-- ============================================================================

INSERT INTO classic_papers (title, authors, year, category, significance, executive_relevance) VALUES

-- Risk Management Classics
('Value at Risk: The New Benchmark for Managing Financial Risk', 
 ARRAY['Philippe Jorion'], 2006, 'risk',
 'Definitive guide to VaR methodology, became industry standard',
 'Essential understanding for risk governance and regulatory discussions'),

('Credit Risk Modeling: Theory and Applications', 
 ARRAY['David Lando'], 2004, 'risk',
 'Foundational academic treatment of credit risk models',
 'Understanding credit risk models used in lending decisions'),

('Against the Gods: The Remarkable Story of Risk',
 ARRAY['Peter L. Bernstein'], 1996, 'risk',
 'Historical perspective on risk management evolution',
 'Strategic context for risk-taking decisions'),

-- AI/ML in Finance
('Machine Learning in Asset Management',
 ARRAY['Marcos Lopez de Prado'], 2018, 'ai-ml',
 'Bridges ML theory and practical portfolio management',
 'Framework for evaluating ML investment strategies'),

('Advances in Financial Machine Learning',
 ARRAY['Marcos Lopez de Prado'], 2018, 'ai-ml',
 'Technical foundations for ML in finance',
 'Understanding AI capabilities and limitations in finance'),

('Deep Learning for Finance',
 ARRAY['Justin Sirignano', 'Rama Cont'], 2019, 'ai-ml',
 'State-of-the-art deep learning applications in finance',
 'Strategic AI investment decisions'),

-- Regulation & Compliance
('Basel III: A Global Regulatory Framework for More Resilient Banks',
 ARRAY['Bank for International Settlements'], 2010, 'regulation',
 'Foundation of modern banking regulation',
 'Core regulatory framework affecting capital and liquidity'),

('The Dodd-Frank Act: A Cheat Sheet',
 ARRAY['Davis Polk'], 2010, 'regulation',
 'Comprehensive overview of post-2008 US financial regulation',
 'Understanding regulatory landscape'),

-- Strategy & Transformation
('Bank 4.0: Banking Everywhere, Never at a Bank',
 ARRAY['Brett King'], 2018, 'strategy',
 'Vision for digital banking transformation',
 'Digital strategy and competitive positioning'),

('The Future of Finance: The Impact of FinTech, AI, and Crypto',
 ARRAY['Henri Arslanian', 'Fabrice Fischer'], 2019, 'strategy',
 'Comprehensive view of fintech disruption',
 'Strategic planning for technology disruption'),

('Competing in the Age of AI',
 ARRAY['Marco Iansiti', 'Karim R. Lakhani'], 2020, 'strategy',
 'Framework for AI-driven business transformation',
 'Board-level AI strategy discussions'),

-- Insurance Specific
('Fundamentals of Risk and Insurance',
 ARRAY['Emmett J. Vaughan', 'Therese Vaughan'], 2013, 'insurance',
 'Standard insurance industry textbook',
 'Foundation for insurance business discussions'),

('InsurTech: A Legal and Regulatory View',
 ARRAY['Pierpaolo Marano', 'Kyriaki Noussia'], 2019, 'insurance',
 'Legal framework for insurance technology',
 'Regulatory considerations for insurtech initiatives'),

-- Quantitative Finance
('Options, Futures, and Other Derivatives',
 ARRAY['John C. Hull'], 2017, 'quant',
 'Industry standard derivatives textbook',
 'Understanding derivatives risk and hedging'),

('The Concepts and Practice of Mathematical Finance',
 ARRAY['Mark Joshi'], 2008, 'quant',
 'Practical quantitative finance',
 'Technical foundation for quant discussions');

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_classic_papers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER classic_papers_updated_at
  BEFORE UPDATE ON classic_papers
  FOR EACH ROW
  EXECUTE FUNCTION update_classic_papers_updated_at();
