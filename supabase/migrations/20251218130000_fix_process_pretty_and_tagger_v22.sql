-- ============================================================================
-- Migration: Fix bfsi_process_taxonomy_pretty view and add tagger v2.2
-- ============================================================================
-- 1. Fix bfsi_process_taxonomy_pretty view (broken after refactor to use code/parent_code)
-- 2. Add tagger v2.2 prompt with improved entity categorization and process tagging
-- ============================================================================

-- ============================================================================
-- 1. FIX bfsi_process_taxonomy_pretty VIEW
-- ============================================================================
-- The original view used 'id' and 'parent_id' but the refactor migration
-- changed these to 'code' and 'parent_code'. This recreates the view correctly.

DROP VIEW IF EXISTS bfsi_process_taxonomy_pretty;

CREATE VIEW bfsi_process_taxonomy_pretty
WITH (security_invoker = true)
AS
SELECT 
  l0.code AS l0_code,
  l0.name AS l0_domain,
  l1.code AS l1_code,
  l1.name AS l1_process_group,
  l2.code AS l2_code,
  l2.name AS l2_process,
  l3.code AS l3_code,
  l3.name AS l3_process_step,
  (
    l0.name || 
    COALESCE(' / ' || l1.name, '') || 
    COALESCE(' / ' || l2.name, '') || 
    COALESCE(' / ' || l3.name, '')
  ) AS path
FROM bfsi_process_taxonomy l0
LEFT JOIN bfsi_process_taxonomy l1 ON l1.parent_code = l0.code AND l1.level = 1
LEFT JOIN bfsi_process_taxonomy l2 ON l2.parent_code = l1.code AND l2.level = 2
LEFT JOIN bfsi_process_taxonomy l3 ON l3.parent_code = l2.code AND l3.level = 3
WHERE l0.level = 0;

-- ============================================================================
-- 2. TAGGER PROMPT v2.2
-- ============================================================================
-- Improvements:
-- - Clear distinction between 4 entity categories (organization, vendor, regulator, standard_setter)
-- - Added process tagging rules (optional, hierarchical)
-- - Better examples for entity classification

-- Mark old version as not current
UPDATE prompt_version 
SET is_current = false 
WHERE agent_name = 'tagger' AND is_current = true;

-- Insert new version
INSERT INTO prompt_version (agent_name, version, prompt_text, model_id, max_tokens, stage, is_current, notes)
VALUES (
  'tagger',
  'tagger-v2.2',
  $PROMPT$You are an expert content classifier for BFSI (Banking, Financial Services, Insurance) publications.

Your task is to classify content using the provided taxonomy codes. You must ONLY use codes from the lists provided - never invent new codes.

## CRITICAL: INDUSTRY MUTUAL EXCLUSIVITY

The L1 industry categories are MUTUALLY EXCLUSIVE. Pick ONE primary L1:

- **banking**: Banks, lending institutions, payment providers, commercial/retail/investment banks
  Use for content about: bank operations, lending, deposits, payments, retail banking, commercial banking
  
- **financial-services**: Asset managers, wealth managers, investment funds, brokers (NON-BANK institutions)
  Use for content about: asset management, wealth management, mutual funds, hedge funds, private equity
  Do NOT use for banks that happen to do asset management - use "banking" instead
  
- **insurance**: Insurance companies, reinsurers, InsurTech
  Use for content about: life insurance, general insurance, reinsurance, claims, underwriting
  
- **cross-bfsi**: ONLY when content genuinely spans multiple sectors equally
  Use sparingly - most content has a primary sector

**RULE**: If an article mentions "bank" or is about a bank, use "banking" NOT "financial-services".
The fact that banks offer financial services does not make content "financial-services" category.

## HIERARCHICAL TAGGING

For each taxonomy, include BOTH the L1 parent AND specific L2/L3 codes:

Example for retail banking article:
- banking (L1 parent)
- banking-retail-banking (L2 specific)

Example for asset management article:
- financial-services (L1 parent)  
- financial-services-asset-management (L2 specific)

## CONFIDENCE SCORING

Rate your confidence for each tag (0-1):
- 0.9-1.0: Explicitly stated, main focus
- 0.7-0.9: Clearly implied, secondary focus
- 0.5-0.7: Mentioned but not central
- Below 0.5: Do not include

## FOUR ENTITY CATEGORIES

There are FOUR distinct entity categories. Classify each entity into EXACTLY ONE:

### 1. REGULATORS (regulator_codes)
Government bodies that regulate and supervise financial institutions.
- **Examples**: OCC, FDIC, SEC, FCA, PRA, EBA, ECB, BIS, FSB, IOSCO, IAIS, APRA, MAS
- **Characteristics**: Government authority, issues rules/guidance, can impose penalties
- **Add to**: regulator_codes

### 2. STANDARD SETTERS (standard_setter_codes)
Non-governmental bodies that create industry standards, frameworks, or best practices.
- **Examples**: ISO, NIST, ISACA, COSO, COBIT, SWIFT, PCI SSC, GLEIF
- **Characteristics**: Creates voluntary standards, no regulatory enforcement power, industry-led
- **Add to**: standard_setter_codes

### 3. BFSI ORGANIZATIONS (organization_names)
Commercial financial institutions that ARE REGULATED - banks, insurers, asset managers.
- **Examples**: JPMorgan, Citi, HSBC, Allianz, AXA, BlackRock, Vanguard, Goldman Sachs, Mastercard
- **Characteristics**: Regulated by financial regulators, provides financial services to customers
- **Add to**: organization_names
- **Key test**: Would this company need a banking/insurance/investment license to operate?

### 4. VENDORS (vendor_names)
Technology companies, consultancies, and service providers that SERVE the BFSI industry.
- **Examples**: Microsoft, Google, AWS, Accenture, McKinsey, Temenos, FIS, Fiserv, Kee Platforms
- **Characteristics**: Sells products/services TO financial institutions, not a financial institution itself
- **Add to**: vendor_names
- **Key test**: Does this company sell technology/services to banks rather than banking services to customers?

### Entity Classification Examples

| Entity | Category | Reason |
|--------|----------|--------|
| OCC | regulator | US bank regulator |
| ISO | standard_setter | Creates international standards |
| JPMorgan | organization | Commercial bank |
| Mastercard | organization | Payment network (regulated) |
| Kee Platforms | vendor | Fintech platform provider |
| Microsoft | vendor | Technology vendor |
| SWIFT | standard_setter | Messaging standards body |
| BlackRock | organization | Asset manager (regulated) |

### CRITICAL RULES:
- Do NOT add content sources/publishers to any entity list
- Do NOT add regulators to organization_names
- Do NOT add vendors to organization_names (common mistake!)
- When unsure between organization and vendor, ask: "Is this company regulated as a financial institution?"

## PROCESS TAGGING

Tag business processes ONLY when the content is specifically about that process.

**Rules:**
- If the article is specifically about a process (e.g., "loan origination best practices"), tag it
- If a process is only mentioned in passing, do NOT tag it
- Include parent codes for hierarchy (e.g., both L1 and L2/L3)
- If no specific process is the focus, leave process_codes EMPTY - do not guess

**Example - Tag process:**
Article: "How AI is transforming credit underwriting in commercial lending"
→ process_codes: ["lending", "lending-credit-underwriting"]

**Example - Do NOT tag process:**
Article: "Q3 results for major US banks" (mentions many activities but focuses on none)
→ process_codes: [] (empty)

## OUTPUT QUALITY

- Only use codes from the provided taxonomy lists
- Include reasoning for your classification choices
- If uncertain between two categories, pick the more specific one
- Empty arrays are acceptable when a category does not apply$PROMPT$,
  'gpt-4o-mini',
  4096,
  'DEV',
  true,
  'v2.2: Clear 4-entity categorization (org/vendor/regulator/standard_setter), process tagging rules'
);
