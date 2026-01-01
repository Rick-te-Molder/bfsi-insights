-- KB-211: Seed golden test set for relevance-filter agent
-- Second-pass filter that verifies content relevance after initial discovery scoring

INSERT INTO eval_golden_set (agent_name, name, description, input, expected_output) VALUES

-- Clearly relevant: Regulatory guidance
('relevance-filter', 'eba-stress-test-methodology', 'EBA stress test methodology - clearly relevant regulatory content',
 '{"title": "EBA publishes 2025 EU-wide stress test methodology", "description": "The European Banking Authority has released the detailed methodology for the 2025 stress test, including macroeconomic scenarios, credit risk parameters, and reporting templates for participating banks."}',
 '{"relevant": true, "min_confidence": 0.8}'),

-- Clearly relevant: Central bank policy
('relevance-filter', 'fed-interest-rate-decision', 'Fed interest rate decision - highly relevant monetary policy',
 '{"title": "Federal Reserve raises interest rates by 25 basis points", "description": "The FOMC voted unanimously to increase the federal funds rate to 5.50%, citing persistent inflation concerns. Chair Powell signaled potential further tightening."}',
 '{"relevant": true, "min_confidence": 0.8}'),

-- Clearly relevant: Fintech innovation
('relevance-filter', 'open-banking-api-standards', 'Open banking API standards - relevant technical content',
 '{"title": "PSD3 draft proposes enhanced API standards for open banking", "description": "The European Commission has published draft PSD3 legislation introducing mandatory API performance standards, liability frameworks for data breaches, and expanded scope to include crypto-assets."}',
 '{"relevant": true, "min_confidence": 0.7}'),

-- Clearly relevant: Risk management
('relevance-filter', 'basel-climate-risk-framework', 'Basel climate risk framework - relevant risk management',
 '{"title": "Basel Committee finalizes climate risk management principles", "description": "BCBS has issued final principles for climate-related financial risk management, covering governance, risk assessment methodologies, and disclosure requirements for internationally active banks."}',
 '{"relevant": true, "min_confidence": 0.8}'),

-- Clearly relevant: Insurance regulation
('relevance-filter', 'solvency-ii-review', 'Solvency II review - relevant insurance regulation',
 '{"title": "EIOPA recommends Solvency II capital requirement changes", "description": "The European Insurance and Occupational Pensions Authority has submitted its final advice on the Solvency II review, proposing adjustments to the risk margin calculation and extrapolation of interest rates."}',
 '{"relevant": true, "min_confidence": 0.8}'),

-- Should reject: Job posting
('relevance-filter', 'job-posting-compliance', 'Job posting - should be rejected even with BFSI keywords',
 '{"title": "Senior Compliance Officer - Global Investment Bank", "description": "We are seeking an experienced compliance professional to join our team. Requirements: 10+ years experience in financial services, knowledge of MiFID II, strong communication skills. Competitive salary and benefits."}',
 '{"relevant": false}'),

-- Should reject: Consumer finance advice
('relevance-filter', 'personal-finance-retirement', 'Personal finance advice - wrong audience',
 '{"title": "5 Ways to Maximize Your Retirement Savings in 2025", "description": "Discover simple strategies to boost your 401k contributions, take advantage of catch-up provisions, and optimize your Social Security claiming strategy for a comfortable retirement."}',
 '{"relevant": false}'),

-- Should reject: Product marketing
('relevance-filter', 'product-marketing-crm', 'Product marketing without insight - should reject',
 '{"title": "Transform Your Bank with Our AI-Powered CRM Solution", "description": "Our cutting-edge platform helps financial institutions increase customer engagement by 50%. Request a demo today and see how leading banks are revolutionizing their customer experience."}',
 '{"relevant": false}'),

-- Should reject: General tech news
('relevance-filter', 'general-tech-ai', 'General AI news without BFSI application',
 '{"title": "OpenAI releases GPT-5 with enhanced reasoning capabilities", "description": "The new model demonstrates significant improvements in mathematical problem-solving and code generation. Available to ChatGPT Plus subscribers starting next month."}',
 '{"relevant": false}'),

-- Should reject: Press release personnel
('relevance-filter', 'press-release-ceo', 'Personnel press release - not substantive content',
 '{"title": "Major Bank Appoints New Chief Risk Officer", "description": "ABC Bank today announced the appointment of Jane Smith as Chief Risk Officer, effective January 1st. Smith brings 20 years of experience from her previous role at XYZ Financial."}',
 '{"relevant": false}'),

-- Edge case: Academic with practical application (should be relevant)
('relevance-filter', 'academic-ml-fraud-detection', 'Academic paper with practical BFSI application',
 '{"title": "Machine Learning Approaches for Real-Time Fraud Detection in Payment Systems", "description": "This paper presents a novel ensemble method combining gradient boosting and neural networks for detecting fraudulent transactions, achieving 99.2% accuracy on a dataset of 10 million card transactions from a major European bank."}',
 '{"relevant": true, "min_confidence": 0.6}'),

-- Edge case: Cybersecurity in finance (should be relevant)
('relevance-filter', 'cyber-attack-bank', 'Cybersecurity incident in banking - relevant',
 '{"title": "Major Ransomware Attack Disrupts Banking Operations Across Southeast Asia", "description": "A coordinated ransomware campaign has affected multiple financial institutions in the region, with attackers demanding cryptocurrency payments. Regulators have issued emergency guidance on incident response."}',
 '{"relevant": true, "min_confidence": 0.7}')

ON CONFLICT DO NOTHING;
