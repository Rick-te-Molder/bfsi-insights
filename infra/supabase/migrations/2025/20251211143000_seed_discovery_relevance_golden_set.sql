-- KB-207 Phase 3: Seed golden test set for discovery-relevance agent
-- These examples are used by the eval runner to test prompt quality

INSERT INTO eval_golden_set (agent_name, name, description, input, expected_output) VALUES

-- High relevance: ECB regulatory
('discovery-relevance', 'ecb-digital-euro-2024', 'ECB regulatory announcement - should score high for executives',
 '{"title": "ECB publishes new digital euro framework for retail payments", "description": "The European Central Bank has released comprehensive guidelines for the digital euro implementation, covering privacy, offline payments, and merchant adoption requirements.", "source": "ecb", "publishedDate": "2024-11-15"}',
 '{"min_score": 7, "primary_audience": "executive", "must_queue": true}'),

-- High relevance: FDIC banking
('discovery-relevance', 'fdic-bank-failure-2024', 'FDIC resolution announcement - relevant for executives',
 '{"title": "FDIC announces resolution of regional bank with $2B in assets", "description": "The Federal Deposit Insurance Corporation has completed the resolution of First Community Bank, transferring all deposits to acquiring institution.", "source": "fdic", "publishedDate": "2024-10-20"}',
 '{"min_score": 6, "primary_audience": "executive", "must_queue": true}'),

-- High relevance: BIS AI risk
('discovery-relevance', 'bis-ai-risk-management', 'BIS AI framework - high relevance for risk specialists',
 '{"title": "BIS publishes principles for AI risk management in banking", "description": "Bank for International Settlements releases new framework addressing model risk, explainability requirements, and governance structures for AI adoption in financial institutions.", "source": "bis", "publishedDate": "2024-09-01"}',
 '{"min_score": 8, "primary_audience": "functional_specialist", "must_queue": true}'),

-- High relevance: McKinsey GenAI
('discovery-relevance', 'mckinsey-genai-banking', 'McKinsey analysis - executive-level strategic content',
 '{"title": "Generative AI in banking: A $340 billion opportunity", "description": "McKinsey analysis reveals how banks can capture value through GenAI in customer service, fraud detection, and back-office automation.", "source": "mckinsey", "publishedDate": "2024-08-15"}',
 '{"min_score": 7, "primary_audience": "executive", "must_queue": true}'),

-- Low relevance: Academic theory
('discovery-relevance', 'academic-theoretical-finance', 'Pure academic paper - low relevance for most audiences',
 '{"title": "A Theoretical Framework for Stochastic Volatility Models Under Jump Diffusion", "description": "This paper presents a novel mathematical framework for analyzing option pricing under combined stochastic volatility and jump diffusion processes.", "source": "arxiv", "publishedDate": "2024-07-01"}',
 '{"max_score": 5, "primary_audience": "researcher", "must_queue": false}'),

-- Not relevant: Consumer finance
('discovery-relevance', 'personal-finance-tips', 'Consumer content - not relevant for BFSI professionals',
 '{"title": "10 Tips to Save Money on Your Next Mortgage", "description": "Consumer guide to getting the best mortgage rates, including tips on credit scores, down payments, and shopping around for lenders.", "source": "unknown", "publishedDate": "2024-06-01"}',
 '{"max_score": 3, "must_queue": false}'),

-- High relevance: DORA regulation
('discovery-relevance', 'dora-implementation-guide', 'DORA implementation - critical for compliance specialists',
 '{"title": "DORA Implementation: Technical Requirements for ICT Risk Management", "description": "Detailed guidance on implementing the Digital Operational Resilience Act, covering incident reporting, third-party risk management, and testing requirements.", "source": "eba", "publishedDate": "2024-05-15"}',
 '{"min_score": 8, "primary_audience": "functional_specialist", "must_queue": true}'),

-- High relevance: Technical API security
('discovery-relevance', 'api-security-banking', 'Technical deep-dive - relevant for engineers',
 '{"title": "Securing Open Banking APIs: OAuth 2.0 Implementation Patterns", "description": "Technical deep-dive into implementing secure OAuth flows for PSD2 compliance, including token management, consent handling, and API gateway configurations.", "source": "unknown", "publishedDate": "2024-04-01"}',
 '{"min_score": 7, "primary_audience": "engineer", "must_queue": true}'),

-- Not relevant: Job posting
('discovery-relevance', 'job-posting-fintech', 'Job posting - should be rejected',
 '{"title": "Senior Software Engineer - Payments Platform", "description": "Join our team building the next generation payment infrastructure. Requirements: 5+ years experience, Java/Kotlin, microservices architecture.", "source": "unknown", "publishedDate": "2024-03-01"}',
 '{"max_score": 2, "must_queue": false}'),

-- High relevance: Fed monetary policy
('discovery-relevance', 'fed-rate-decision-2024', 'Fed rate decision - high impact for executives',
 '{"title": "Federal Reserve maintains rates, signals potential cuts in 2025", "description": "FOMC holds federal funds rate steady at 5.25-5.50%, with updated dot plot suggesting three rate cuts next year amid cooling inflation.", "source": "federalreserve", "publishedDate": "2024-12-01"}',
 '{"min_score": 8, "primary_audience": "executive", "must_queue": true}'),

-- Stale content: Should be rejected
('discovery-relevance', 'stale-fdic-1996', 'Stale FDIC content - should be rejected due to age/inactive status',
 '{"title": "FDIC Letter: Guidance on Electronic Fund Transfers", "description": "INACTIVE - This 1996 guidance has been superseded by subsequent regulatory updates.", "source": "fdic", "publishedDate": "1996-03-15"}',
 '{"max_score": 3, "must_queue": false}'),

-- High relevance: InsurTech case study
('discovery-relevance', 'insurtech-claims-ai', 'InsurTech AI case study - relevant for executives',
 '{"title": "How AI is Transforming Insurance Claims Processing", "description": "Case study on major insurer deploying computer vision and NLP for automated claims assessment, achieving 60% reduction in processing time.", "source": "unknown", "publishedDate": "2024-10-01"}',
 '{"min_score": 7, "primary_audience": "executive", "must_queue": true}')

ON CONFLICT DO NOTHING;

COMMENT ON TABLE eval_golden_set IS 'Human-verified test cases for agent evaluation. KB-207 Phase 3.';
