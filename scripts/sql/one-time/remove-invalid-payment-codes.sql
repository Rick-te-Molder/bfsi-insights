-- Remove LLM-generated payment codes from kb_publication_bfsi_industry
-- These codes don't exist in the bfsi_industry taxonomy

-- Invalid codes to remove:
-- banking-payments-cross-border-payments-remittance
-- banking-payments-crypto-digital-asset-payments
-- banking-payments-digital-wallets-e-money
-- banking-payments-merchant-acquiring-pos-solutions
-- banking-payments-payment-gateways-api-platforms

-- First, let's see which publications have these codes
SELECT 
  p.id,
  p.title,
  pbi.industry_code
FROM kb_publication p
JOIN kb_publication_bfsi_industry pbi ON p.id = pbi.publication_id
WHERE pbi.industry_code IN (
  'banking-payments-cross-border-payments-remittance',
  'banking-payments-crypto-digital-asset-payments',
  'banking-payments-digital-wallets-e-money',
  'banking-payments-merchant-acquiring-pos-solutions',
  'banking-payments-payment-gateways-api-platforms'
)
ORDER BY p.title, pbi.industry_code;

-- Count affected rows
SELECT COUNT(*) as affected_rows
FROM kb_publication_bfsi_industry
WHERE industry_code IN (
  'banking-payments-cross-border-payments-remittance',
  'banking-payments-crypto-digital-asset-payments',
  'banking-payments-digital-wallets-e-money',
  'banking-payments-merchant-acquiring-pos-solutions',
  'banking-payments-payment-gateways-api-platforms'
);

-- Remove the invalid codes from the junction table
-- UNCOMMENT THE FOLLOWING TO EXECUTE THE DELETE:

/*
DELETE FROM kb_publication_bfsi_industry
WHERE industry_code IN (
  'banking-payments-cross-border-payments-remittance',
  'banking-payments-crypto-digital-asset-payments',
  'banking-payments-digital-wallets-e-money',
  'banking-payments-merchant-acquiring-pos-solutions',
  'banking-payments-payment-gateways-api-platforms'
);
*/

-- After running the delete, verify the results (should return 0 rows):
/*
SELECT 
  p.id,
  p.title,
  pbi.industry_code
FROM kb_publication p
JOIN kb_publication_bfsi_industry pbi ON p.id = pbi.publication_id
WHERE pbi.industry_code IN (
  'banking-payments-cross-border-payments-remittance',
  'banking-payments-crypto-digital-asset-payments',
  'banking-payments-digital-wallets-e-money',
  'banking-payments-merchant-acquiring-pos-solutions',
  'banking-payments-payment-gateways-api-platforms'
)
ORDER BY p.title;
*/
