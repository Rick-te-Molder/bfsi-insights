-- KB-171: Seed additional sources from KB-169 comprehensive list
-- 
-- Categories covered:
-- 1. EU Regulators
-- 2. NL Regulators  
-- 3. International Regulators
-- 4. Statistical sources
-- 5. BFSI Tech Vendors
-- 6. AI/Agentic Vendors
-- 7. Academic sources
-- 8. Standards bodies

-- ============================================================
-- EU REGULATORS
-- ============================================================

INSERT INTO kb_source (slug, name, domain, category, channel_slug, tier, enabled, description, sort_order) VALUES
  ('eba', 'European Banking Authority', 'eba.europa.eu', 'regulator', 'regulatory_intelligence', 'premium', true,
   'Technical Standards, Guidelines, Q&A for EU banking regulation', 100),
  ('esma', 'European Securities and Markets Authority', 'esma.europa.eu', 'regulator', 'regulatory_intelligence', 'premium', true,
   'MiFID II updates, guidance, reporting requirements', 100),
  ('eiopa', 'European Insurance and Occupational Pensions Authority', 'eiopa.europa.eu', 'regulator', 'regulatory_intelligence', 'premium', true,
   'Solvency II, stress test reports, insurance supervision', 100),
  ('ec-fisma', 'European Commission FISMA', 'finance.ec.europa.eu', 'regulator', 'regulatory_intelligence', 'premium', true,
   'EU financial legislation, impact assessments, DORA, AI Act', 100),
  ('srb', 'Single Resolution Board', 'srb.europa.eu', 'regulator', 'regulatory_intelligence', 'standard', true,
   'Resolution plans, MREL requirements', 150)
ON CONFLICT (slug) DO UPDATE SET
  channel_slug = EXCLUDED.channel_slug,
  description = EXCLUDED.description;

-- ============================================================
-- NL REGULATORS
-- ============================================================

INSERT INTO kb_source (slug, name, domain, category, channel_slug, tier, enabled, description, sort_order) VALUES
  ('afm', 'Autoriteit Financiële Markten', 'afm.nl', 'regulator', 'regulatory_intelligence', 'premium', true,
   'Dutch financial conduct authority - leidraden, toezichtsignalen, onderzoeken', 100),
  ('ap', 'Autoriteit Persoonsgegevens', 'autoriteitpersoonsgegevens.nl', 'regulator', 'regulatory_intelligence', 'standard', true,
   'Dutch data protection authority - richtsnoeren, handhaving, GDPR', 150),
  ('acm', 'Autoriteit Consument & Markt', 'acm.nl', 'regulator', 'regulatory_intelligence', 'standard', true,
   'Competition and consumer authority - payment market rules', 150),
  ('kifid', 'Kifid', 'kifid.nl', 'regulator', 'regulatory_intelligence', 'standard', true,
   'Financial services complaints institute - uitspraken, trends', 200)
ON CONFLICT (slug) DO UPDATE SET
  channel_slug = EXCLUDED.channel_slug,
  description = EXCLUDED.description;

-- ============================================================
-- INTERNATIONAL REGULATORS
-- ============================================================

INSERT INTO kb_source (slug, name, domain, category, channel_slug, tier, enabled, description, sort_order) VALUES
  ('fca', 'Financial Conduct Authority', 'fca.org.uk', 'regulator', 'regulatory_intelligence', 'premium', true,
   'UK financial regulator - policy statements, Dear CEO letters, innovation guidance', 100),
  ('pra', 'Prudential Regulation Authority', 'bankofengland.co.uk', 'regulator', 'regulatory_intelligence', 'premium', true,
   'UK prudential regulator - supervisory statements, capital requirements', 100),
  ('fincen', 'FinCEN', 'fincen.gov', 'regulator', 'regulatory_intelligence', 'standard', true,
   'US Financial Crimes Enforcement - AML advisories, red flags', 150),
  ('occ', 'Office of the Comptroller of the Currency', 'occ.gov', 'regulator', 'regulatory_intelligence', 'standard', true,
   'US national bank regulator - bulletins, enforcement', 150),
  ('fdic', 'Federal Deposit Insurance Corporation', 'fdic.gov', 'regulator', 'regulatory_intelligence', 'standard', true,
   'US deposit insurance - financial institution letters, guidance', 150),
  ('mas', 'Monetary Authority of Singapore', 'mas.gov.sg', 'regulator', 'regulatory_intelligence', 'premium', true,
   'Singapore central bank & regulator - leading fintech/AI regulation globally', 100)
ON CONFLICT (slug) DO UPDATE SET
  channel_slug = EXCLUDED.channel_slug,
  description = EXCLUDED.description;

-- ============================================================
-- STATISTICAL SOURCES
-- ============================================================

INSERT INTO kb_source (slug, name, domain, category, channel_slug, tier, enabled, description, sort_order) VALUES
  ('ecb-sdw', 'ECB Statistical Data Warehouse', 'sdw.ecb.europa.eu', 'central_bank', 'prudential_statistics', 'premium', true,
   'Euro area financial and economic statistics', 100),
  ('dnb-stats', 'DNB Statistiek', 'statistiek.dnb.nl', 'central_bank', 'prudential_statistics', 'premium', true,
   'Dutch central bank statistics - monetary, payments, financial', 100),
  ('eurostat', 'Eurostat', 'ec.europa.eu/eurostat', 'government_body', 'prudential_statistics', 'standard', true,
   'EU statistical office - economic indicators', 150),
  ('oecd-data', 'OECD Data', 'data.oecd.org', 'research', 'prudential_statistics', 'standard', true,
   'Economic data and indicators from OECD countries', 150),
  ('imf-data', 'IMF Data Portal', 'data.imf.org', 'research', 'prudential_statistics', 'standard', true,
   'International financial and economic data', 150),
  ('worldbank-data', 'World Bank Open Data', 'data.worldbank.org', 'research', 'open_datasets', 'standard', true,
   'Development and economic indicators globally', 150),
  ('epc', 'European Payments Council', 'europeanpaymentscouncil.eu', 'standards_body', 'prudential_statistics', 'standard', true,
   'SEPA payment statistics and standards', 150)
ON CONFLICT (slug) DO UPDATE SET
  channel_slug = EXCLUDED.channel_slug,
  description = EXCLUDED.description;

-- ============================================================
-- FRAUD/AML/CYBER SOURCES
-- ============================================================

INSERT INTO kb_source (slug, name, domain, category, channel_slug, tier, enabled, description, sort_order) VALUES
  ('fatf', 'Financial Action Task Force', 'fatf-gafi.org', 'standards_body', 'regulatory_intelligence', 'premium', true,
   'Global AML/CFT standards, mutual evaluations, guidance', 100),
  ('enisa', 'ENISA', 'enisa.europa.eu', 'regulator', 'regulatory_intelligence', 'standard', true,
   'EU cybersecurity agency - threat reports, guidance', 150),
  ('europol-iocta', 'Europol IOCTA', 'europol.europa.eu', 'government_body', 'regulatory_intelligence', 'standard', true,
   'Internet Organised Crime Threat Assessment', 150)
ON CONFLICT (slug) DO UPDATE SET
  channel_slug = EXCLUDED.channel_slug,
  description = EXCLUDED.description;

-- ============================================================
-- BFSI TECH VENDORS
-- ============================================================

INSERT INTO kb_source (slug, name, domain, category, channel_slug, tier, enabled, description, sort_order) VALUES
  ('ohpen', 'Ohpen', 'ohpen.com', 'vendor', 'vendor_innovation', 'standard', true,
   'Cloud banking platform - case studies, whitepapers', 200),
  ('mambu', 'Mambu', 'mambu.com', 'vendor', 'vendor_innovation', 'standard', true,
   'SaaS banking engine - product docs, case briefs', 200),
  ('thought-machine', 'Thought Machine', 'thoughtmachine.net', 'vendor', 'vendor_innovation', 'standard', true,
   'Core banking - architecture papers', 200),
  ('temenos', 'Temenos', 'temenos.com', 'vendor', 'vendor_innovation', 'standard', true,
   'Banking software - regulatory notes, compliance updates', 200),
  ('finastra', 'Finastra', 'finastra.com', 'vendor', 'vendor_innovation', 'standard', true,
   'Financial software - open banking, payments', 200),
  ('feedzai', 'Feedzai', 'feedzai.com', 'vendor', 'vendor_innovation', 'standard', true,
   'AI fraud prevention - risk intelligence', 200),
  ('taktile', 'Taktile', 'taktile.com', 'vendor', 'vendor_innovation', 'standard', true,
   'Credit decisioning automation', 200)
ON CONFLICT (slug) DO UPDATE SET
  channel_slug = EXCLUDED.channel_slug,
  description = EXCLUDED.description;

-- ============================================================
-- AI/AGENTIC VENDORS
-- ============================================================

INSERT INTO kb_source (slug, name, domain, category, channel_slug, tier, enabled, description, sort_order) VALUES
  ('openai-blog', 'OpenAI Blog', 'openai.com', 'vendor', 'vendor_innovation', 'premium', true,
   'OpenAI developer blog, research, product updates', 100),
  ('anthropic', 'Anthropic Research', 'anthropic.com', 'vendor', 'vendor_innovation', 'premium', true,
   'Claude, constitutional AI, safety research', 100),
  ('deepmind', 'Google DeepMind', 'deepmind.google', 'vendor', 'vendor_innovation', 'premium', true,
   'AI research papers, Gemini updates', 100),
  ('meta-ai', 'Meta AI Research', 'ai.meta.com', 'vendor', 'vendor_innovation', 'standard', true,
   'LLaMA, open models, research', 150),
  ('microsoft-research', 'Microsoft Research', 'microsoft.com/research', 'vendor', 'vendor_innovation', 'standard', true,
   'AI research, Azure AI updates', 150),
  ('nvidia-tech', 'Nvidia Technical Blog', 'developer.nvidia.com', 'vendor', 'vendor_innovation', 'standard', true,
   'GPU computing, AI infrastructure', 150),
  ('huggingface', 'Hugging Face', 'huggingface.co', 'vendor', 'academic_research', 'standard', true,
   'Model cards, papers, open source ML', 150),
  ('langchain-blog', 'LangChain Blog', 'blog.langchain.dev', 'vendor', 'vendor_innovation', 'standard', true,
   'LangChain, LangGraph, agentic patterns', 150)
ON CONFLICT (slug) DO UPDATE SET
  channel_slug = EXCLUDED.channel_slug,
  description = EXCLUDED.description;

-- ============================================================
-- ACADEMIC SOURCES
-- ============================================================

INSERT INTO kb_source (slug, name, domain, category, channel_slug, tier, enabled, description, sort_order) VALUES
  ('nber', 'NBER', 'nber.org', 'academic', 'academic_research', 'standard', true,
   'National Bureau of Economic Research - working papers', 150),
  ('repec', 'RePEc', 'repec.org', 'academic', 'academic_research', 'standard', true,
   'Research Papers in Economics - open repository', 200),
  ('cpb', 'CPB Netherlands', 'cpb.nl', 'research', 'academic_research', 'standard', true,
   'Centraal Planbureau - Dutch economic policy analysis', 150),
  ('wrr', 'WRR', 'wrr.nl', 'research', 'academic_research', 'standard', true,
   'Wetenschappelijke Raad voor het Regeringsbeleid - policy research', 200),
  ('cepr', 'CEPR', 'cepr.org', 'academic', 'academic_research', 'standard', true,
   'Centre for Economic Policy Research - policy insights', 150)
ON CONFLICT (slug) DO UPDATE SET
  channel_slug = EXCLUDED.channel_slug,
  description = EXCLUDED.description;

-- ============================================================
-- STANDARDS BODIES
-- ============================================================

INSERT INTO kb_source (slug, name, domain, category, channel_slug, tier, enabled, description, sort_order) VALUES
  ('nist', 'NIST', 'nist.gov', 'standards_body', 'regulatory_intelligence', 'standard', true,
   'US standards - SP 800 series, AI RMF, cybersecurity', 150),
  ('bcbs', 'Basel Committee (BCBS)', 'bis.org/bcbs', 'standards_body', 'regulatory_intelligence', 'premium', true,
   'Basel capital standards, consultative papers', 100)
ON CONFLICT (slug) DO UPDATE SET
  channel_slug = EXCLUDED.channel_slug,
  description = EXCLUDED.description;

-- ============================================================
-- OPEN DATASETS
-- ============================================================

INSERT INTO kb_source (slug, name, domain, category, channel_slug, tier, enabled, description, sort_order) VALUES
  ('uk-openbanking', 'UK Open Banking', 'openbanking.org.uk', 'standards_body', 'open_datasets', 'standard', true,
   'UK Open Banking API specs, adoption metrics', 150),
  ('cbs', 'CBS Netherlands', 'cbs.nl', 'government_body', 'open_datasets', 'standard', true,
   'Dutch statistics bureau - economic data', 150),
  ('knmi', 'KNMI', 'knmi.nl', 'government_body', 'open_datasets', 'standard', true,
   'Dutch climate data - relevant for insurance risk', 200),
  ('bis-innovation', 'BIS Innovation Hub', 'bisih.org', 'research', 'open_datasets', 'standard', true,
   'Central bank innovation projects, datasets', 150)
ON CONFLICT (slug) DO UPDATE SET
  channel_slug = EXCLUDED.channel_slug,
  description = EXCLUDED.description;

-- ============================================================
-- UPDATE EXISTING SOURCES WITH CHANNELS
-- ============================================================
-- Ensure all existing sources have a channel assigned

-- ECB main → regulatory_intelligence (supervisory)
UPDATE kb_source SET channel_slug = 'regulatory_intelligence', category = 'central_bank'
WHERE slug = 'ecb' AND channel_slug IS NULL;

-- Fed → regulatory_intelligence
UPDATE kb_source SET channel_slug = 'regulatory_intelligence', category = 'central_bank'
WHERE slug = 'fed' AND channel_slug IS NULL;

-- DNB → regulatory_intelligence
UPDATE kb_source SET channel_slug = 'regulatory_intelligence', category = 'central_bank'
WHERE slug = 'dnb' AND channel_slug IS NULL;

-- FSB → regulatory_intelligence
UPDATE kb_source SET channel_slug = 'regulatory_intelligence'
WHERE slug = 'fsb' AND channel_slug IS NULL;

-- BIS → academic_research (working papers focus)
UPDATE kb_source SET channel_slug = 'academic_research'
WHERE slug = 'bis' AND channel_slug IS NULL;

-- IMF → regulatory_intelligence (policy focus)
UPDATE kb_source SET channel_slug = 'regulatory_intelligence'
WHERE slug = 'imf' AND channel_slug IS NULL;

-- arXiv sources → academic_research
UPDATE kb_source SET channel_slug = 'academic_research'
WHERE slug LIKE 'arxiv%' AND channel_slug IS NULL;

-- SSRN → academic_research
UPDATE kb_source SET channel_slug = 'academic_research'
WHERE slug = 'ssrn' AND channel_slug IS NULL;

-- McKinsey, BCG, Deloitte etc → vendor_innovation
UPDATE kb_source SET channel_slug = 'vendor_innovation'
WHERE category = 'consulting' AND channel_slug IS NULL;

-- OpenAI existing → vendor_innovation
UPDATE kb_source SET channel_slug = 'vendor_innovation'
WHERE slug = 'openai' AND channel_slug IS NULL;

-- Catch-all: any remaining sources without channel
UPDATE kb_source SET channel_slug = 'vendor_innovation'
WHERE channel_slug IS NULL;

