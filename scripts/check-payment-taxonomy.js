/**
 * Check if payment-related taxonomy codes exist in the database
 */
/* eslint-env node */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.PUBLIC_SUPABASE_ANON_KEY,
);

async function checkPaymentTaxonomy() {
  console.log('Checking payment taxonomy codes in database...\n');

  // Payment codes from the screenshot
  const paymentCodes = [
    'banking-payments',
    'banking-payments-bnpl-embedded-finance',
    'banking-payments-card-issuing-processing',
    'banking-payments-cross-border-payments-remittance',
    'banking-payments-crypto-digital-asset-payments',
    'banking-payments-digital-wallets-e-money',
    'banking-payments-merchant-acquiring-pos-solutions',
    'banking-payments-payment-gateways-api-platforms',
    'banking-payments-real-time-instant',
    'banking-payments-payment-services',
  ];

  // Query bfsi_industry for these codes
  const { data, error } = await supabase
    .from('bfsi_industry')
    .select('code, name, level, parent_code')
    .in('code', paymentCodes)
    .order('code');

  if (error) {
    console.error('Error querying taxonomy:', error);
    return;
  }

  console.log(
    `Found ${data.length} out of ${paymentCodes.length} payment codes in bfsi_industry:\n`,
  );

  if (data.length > 0) {
    console.log('Codes found in database:');
    data.forEach((item) => {
      console.log(`  ✓ ${item.code}`);
      console.log(`    Name: ${item.name}`);
      console.log(`    Level: ${item.level}, Parent: ${item.parent_code || 'none'}\n`);
    });
  }

  const foundCodes = new Set(data.map((d) => d.code));
  const missingCodes = paymentCodes.filter((code) => !foundCodes.has(code));

  if (missingCodes.length > 0) {
    console.log('\nCodes NOT found in database (possibly LLM-generated):');
    missingCodes.forEach((code) => {
      console.log(`  ✗ ${code}`);
    });
  }

  // Also check if there's a PAYMENTS parent
  const { data: paymentsParent } = await supabase
    .from('bfsi_industry')
    .select('code, name, level, parent_code')
    .eq('code', 'banking-payments')
    .single();

  if (paymentsParent) {
    console.log('\n\nPayments parent taxonomy:');
    console.log(`  Code: ${paymentsParent.code}`);
    console.log(`  Name: ${paymentsParent.name}`);
    console.log(`  Level: ${paymentsParent.level}`);
    console.log(`  Parent: ${paymentsParent.parent_code || 'none'}`);
  }
}

checkPaymentTaxonomy().catch(console.error);
