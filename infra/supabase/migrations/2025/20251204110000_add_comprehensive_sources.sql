-- ============================================================================
-- Add comprehensive BFSI sources from inventory
-- Based on: regulators, research, fintech news, academic sources
-- ============================================================================

-- Priority 1: EU Regulators
INSERT INTO kb_source (slug, name, domain, category, tier, enabled, rss_feed, sitemap_url, description) VALUES
('eba', 'European Banking Authority', 'eba.europa.eu', 'regulator', 'premium', true,
  'https://www.eba.europa.eu/rss.xml',
  'https://www.eba.europa.eu/sitemap.xml',
  'EU banking supervision standards, guidelines, and Q&A'),
('esma', 'European Securities and Markets Authority', 'esma.europa.eu', 'regulator', 'premium', true,
  'https://www.esma.europa.eu/rss.xml',
  'https://www.esma.europa.eu/sitemap.xml',
  'MiFID II, market regulation, and securities supervision'),
('eiopa', 'European Insurance and Occupational Pensions Authority', 'eiopa.europa.eu', 'regulator', 'premium', true,
  'https://www.eiopa.europa.eu/rss.xml',
  'https://www.eiopa.europa.eu/sitemap.xml',
  'Solvency II, insurance regulation, pension supervision'),
('ec-fisma', 'European Commission - Financial Services', 'finance.ec.europa.eu', 'regulator', 'premium', true,
  NULL,
  'https://finance.ec.europa.eu/sitemap.xml',
  'EU financial legislation, DORA, AI Act, PSD2'),
('srb', 'Single Resolution Board', 'srb.europa.eu', 'regulator', 'premium', true,
  'https://www.srb.europa.eu/en/rss.xml',
  'https://www.srb.europa.eu/sitemap.xml',
  'Bank resolution, MREL, resolution planning')
ON CONFLICT (slug) DO UPDATE SET
  rss_feed = EXCLUDED.rss_feed,
  sitemap_url = EXCLUDED.sitemap_url,
  enabled = EXCLUDED.enabled;

-- Priority 2: Dutch Regulators
INSERT INTO kb_source (slug, name, domain, category, tier, enabled, rss_feed, sitemap_url, description) VALUES
('dnb', 'De Nederlandsche Bank', 'dnb.nl', 'regulator', 'premium', true,
  'https://www.dnb.nl/rss/',
  'https://www.dnb.nl/sitemap.xml',
  'Dutch central bank, prudential supervision, financial stability'),
('afm', 'Autoriteit Financiële Markten', 'afm.nl', 'regulator', 'premium', true,
  'https://www.afm.nl/nl-nl/sector/actueel/rss',
  'https://www.afm.nl/sitemap.xml',
  'Dutch financial markets authority, conduct supervision'),
('ap', 'Autoriteit Persoonsgegevens', 'autoriteitpersoonsgegevens.nl', 'regulator', 'standard', true,
  NULL,
  'https://www.autoriteitpersoonsgegevens.nl/sitemap.xml',
  'Dutch data protection authority, GDPR enforcement')
ON CONFLICT (slug) DO UPDATE SET
  rss_feed = EXCLUDED.rss_feed,
  sitemap_url = EXCLUDED.sitemap_url,
  enabled = EXCLUDED.enabled;

-- Priority 3: UK Regulators
INSERT INTO kb_source (slug, name, domain, category, tier, enabled, rss_feed, sitemap_url, description) VALUES
('fca', 'Financial Conduct Authority', 'fca.org.uk', 'regulator', 'premium', true,
  'https://www.fca.org.uk/rss.xml',
  'https://www.fca.org.uk/sitemap.xml',
  'UK conduct regulation, Dear CEO letters, innovation guidance'),
('boe', 'Bank of England', 'bankofengland.co.uk', 'regulator', 'premium', true,
  'https://www.bankofengland.co.uk/rss/news',
  'https://www.bankofengland.co.uk/sitemap.xml',
  'UK central bank, PRA supervision, monetary policy'),
('pra', 'Prudential Regulation Authority', 'bankofengland.co.uk', 'regulator', 'premium', true,
  'https://www.bankofengland.co.uk/rss/prudential-regulation',
  NULL,
  'UK prudential supervision, supervisory statements')
ON CONFLICT (slug) DO UPDATE SET
  rss_feed = EXCLUDED.rss_feed,
  sitemap_url = EXCLUDED.sitemap_url,
  enabled = EXCLUDED.enabled;

-- Priority 4: Asia-Pacific Regulators
INSERT INTO kb_source (slug, name, domain, category, tier, enabled, rss_feed, sitemap_url, description) VALUES
('mas', 'Monetary Authority of Singapore', 'mas.gov.sg', 'regulator', 'premium', true,
  'https://www.mas.gov.sg/rss/default.aspx',
  'https://www.mas.gov.sg/sitemap.xml',
  'Singapore financial regulation, fintech sandbox, AI guidance')
ON CONFLICT (slug) DO UPDATE SET
  rss_feed = EXCLUDED.rss_feed,
  sitemap_url = EXCLUDED.sitemap_url,
  enabled = EXCLUDED.enabled;

-- Priority 5: US Regulators
INSERT INTO kb_source (slug, name, domain, category, tier, enabled, rss_feed, sitemap_url, description) VALUES
('occ', 'Office of the Comptroller of the Currency', 'occ.gov', 'regulator', 'standard', true,
  'https://www.occ.gov/rss/occ-rss.xml',
  'https://www.occ.gov/sitemap.xml',
  'US national bank supervision, guidance, enforcement'),
('fdic', 'Federal Deposit Insurance Corporation', 'fdic.gov', 'regulator', 'standard', true,
  'https://www.fdic.gov/rss/rss.xml',
  'https://www.fdic.gov/sitemap.xml',
  'US deposit insurance, bank supervision'),
('sec', 'Securities and Exchange Commission', 'sec.gov', 'regulator', 'standard', true,
  'https://www.sec.gov/rss/news/press.xml',
  'https://www.sec.gov/sitemap.xml',
  'US securities regulation, enforcement, guidance'),
('fincen', 'Financial Crimes Enforcement Network', 'fincen.gov', 'regulator', 'standard', true,
  NULL,
  'https://www.fincen.gov/sitemap.xml',
  'US AML/CFT, advisories, red flags')
ON CONFLICT (slug) DO UPDATE SET
  rss_feed = EXCLUDED.rss_feed,
  sitemap_url = EXCLUDED.sitemap_url,
  enabled = EXCLUDED.enabled;

-- Priority 6: Research & Think Tanks
INSERT INTO kb_source (slug, name, domain, category, tier, enabled, rss_feed, sitemap_url, description) VALUES
('nber', 'National Bureau of Economic Research', 'nber.org', 'research', 'standard', true,
  'https://www.nber.org/rss/new.xml',
  'https://www.nber.org/sitemap.xml',
  'Economic research, working papers, BFSI studies'),
('cpb', 'Centraal Planbureau', 'cpb.nl', 'research', 'standard', true,
  'https://www.cpb.nl/rss.xml',
  'https://www.cpb.nl/sitemap.xml',
  'Dutch economic policy research'),
('cepr', 'Centre for Economic Policy Research', 'cepr.org', 'research', 'standard', true,
  'https://cepr.org/rss.xml',
  'https://cepr.org/sitemap.xml',
  'European economic research, policy insights'),
('brookings', 'Brookings Institution', 'brookings.edu', 'research', 'standard', true,
  'https://www.brookings.edu/feed/',
  'https://www.brookings.edu/sitemap.xml',
  'Policy research, financial regulation analysis'),
('bis-research', 'BIS Working Papers', 'bis.org', 'research', 'standard', true,
  'https://www.bis.org/doclist/bis_fsi_publs.rss',
  NULL,
  'BIS research papers on financial stability, fintech, risk')
ON CONFLICT (slug) DO UPDATE SET
  rss_feed = EXCLUDED.rss_feed,
  sitemap_url = EXCLUDED.sitemap_url,
  enabled = EXCLUDED.enabled;

-- Priority 7: Fintech & Payments News
INSERT INTO kb_source (slug, name, domain, category, tier, enabled, rss_feed, sitemap_url, description) VALUES
('finextra', 'Finextra', 'finextra.com', 'publication', 'standard', true,
  'https://www.finextra.com/rss/headlines.aspx',
  'https://www.finextra.com/sitemap.xml',
  'Fintech news, banking technology, payments'),
('paypers', 'The Paypers', 'thepaypers.com', 'publication', 'standard', true,
  'https://thepaypers.com/rss',
  'https://thepaypers.com/sitemap.xml',
  'Payments industry news and analysis'),
('epc', 'European Payments Council', 'europeanpaymentscouncil.eu', 'regulator', 'standard', true,
  NULL,
  'https://www.europeanpaymentscouncil.eu/sitemap.xml',
  'SEPA, payment standards, PSD2 implementation'),
('pymnts', 'PYMNTS', 'pymnts.com', 'publication', 'standard', true,
  'https://www.pymnts.com/feed/',
  'https://www.pymnts.com/sitemap.xml',
  'Payments and commerce news')
ON CONFLICT (slug) DO UPDATE SET
  rss_feed = EXCLUDED.rss_feed,
  sitemap_url = EXCLUDED.sitemap_url,
  enabled = EXCLUDED.enabled;

-- Priority 8: Industry Associations
INSERT INTO kb_source (slug, name, domain, category, tier, enabled, rss_feed, sitemap_url, description) VALUES
('fatf', 'Financial Action Task Force', 'fatf-gafi.org', 'regulator', 'premium', true,
  NULL,
  'https://www.fatf-gafi.org/sitemap.xml',
  'AML/CFT standards, country evaluations, guidance'),
('bcbs', 'Basel Committee on Banking Supervision', 'bis.org', 'regulator', 'premium', true,
  'https://www.bis.org/doclist/bcbs_publs.rss',
  NULL,
  'Basel III/IV, banking standards, consultative papers'),
('isda', 'International Swaps and Derivatives Association', 'isda.org', 'regulator', 'standard', true,
  NULL,
  'https://www.isda.org/sitemap.xml',
  'Derivatives standards, documentation, market analysis')
ON CONFLICT (slug) DO UPDATE SET
  rss_feed = EXCLUDED.rss_feed,
  sitemap_url = EXCLUDED.sitemap_url,
  enabled = EXCLUDED.enabled;

-- Priority 9: Cyber & Data Security
INSERT INTO kb_source (slug, name, domain, category, tier, enabled, rss_feed, sitemap_url, description) VALUES
('enisa', 'European Union Agency for Cybersecurity', 'enisa.europa.eu', 'regulator', 'standard', true,
  'https://www.enisa.europa.eu/rss.xml',
  'https://www.enisa.europa.eu/sitemap.xml',
  'EU cybersecurity, threat reports, DORA guidance'),
('nist', 'NIST Cybersecurity', 'nist.gov', 'research', 'standard', true,
  'https://www.nist.gov/news-events/news/rss.xml',
  NULL,
  'Cybersecurity frameworks, AI standards, SP 800 series')
ON CONFLICT (slug) DO UPDATE SET
  rss_feed = EXCLUDED.rss_feed,
  sitemap_url = EXCLUDED.sitemap_url,
  enabled = EXCLUDED.enabled;

-- Summary
DO $$
DECLARE
  new_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO new_count FROM kb_source;
  RAISE NOTICE 'Total sources after migration: %', new_count;
END $$;
