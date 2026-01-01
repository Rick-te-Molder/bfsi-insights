-- Seed standard_setter table with 10 key standards organizations
-- These are the most important standard setters for BFSI and technology governance

INSERT INTO standard_setter (name, slug, website_url, country_code, domain, notes) VALUES
-- Global standards bodies
('International Organization for Standardization', 'iso', 'https://www.iso.org', NULL, 'iso.org', 'Develops international standards including ISO 27001 (InfoSec), ISO 31000 (Risk Management), ISO 22301 (Business Continuity)'),

('National Institute of Standards and Technology', 'nist', 'https://www.nist.gov', 'US', 'nist.gov', 'US federal agency. Publishes NIST Cybersecurity Framework, SP 800 series, AI RMF'),

('International Electrotechnical Commission', 'iec', 'https://www.iec.ch', NULL, 'iec.ch', 'International standards for electrical/electronic technologies. Partners with ISO on joint standards (ISO/IEC 27001)'),

-- IT/Audit governance frameworks
('ISACA', 'isaca', 'https://www.isaca.org', 'US', 'isaca.org', 'Publishes COBIT framework for IT governance and control. Also manages CISA, CISM certifications'),

('Committee of Sponsoring Organizations of the Treadway Commission', 'coso', 'https://www.coso.org', 'US', 'coso.org', 'Publishes COSO Internal Control Framework and COSO ERM Framework'),

-- Security standards
('Payment Card Industry Security Standards Council', 'pci-ssc', 'https://www.pcisecuritystandards.org', 'US', 'pcisecuritystandards.org', 'Develops and manages PCI DSS, PCI PA-DSS, and other payment security standards'),

-- Accounting standards
('International Accounting Standards Board', 'iasb', 'https://www.ifrs.org', 'GB', 'ifrs.org', 'Develops IFRS accounting standards used globally'),

('Financial Accounting Standards Board', 'fasb', 'https://www.fasb.org', 'US', 'fasb.org', 'Develops US GAAP accounting standards'),

-- Technology standards
('Institute of Electrical and Electronics Engineers', 'ieee', 'https://www.ieee.org', 'US', 'ieee.org', 'Develops technology standards including IEEE 802 (networking), IEEE 754 (floating-point)'),

('Internet Engineering Task Force', 'ietf', 'https://www.ietf.org', NULL, 'ietf.org', 'Develops internet standards (RFCs) including TLS, HTTP, DNS protocols')

ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  website_url = EXCLUDED.website_url,
  country_code = EXCLUDED.country_code,
  domain = EXCLUDED.domain,
  notes = EXCLUDED.notes,
  updated_at = now();
