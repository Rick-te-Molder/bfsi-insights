/**
 * Remove LLM-generated payment codes from publications
 * These codes don't exist in the bfsi_industry taxonomy
 */
/* eslint-env node */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY, // Need service role for updates
);

// Invalid codes that don't exist in taxonomy
const invalidCodes = [
  'banking-payments-cross-border-payments-remittance',
  'banking-payments-crypto-digital-asset-payments',
  'banking-payments-digital-wallets-e-money',
  'banking-payments-merchant-acquiring-pos-solutions',
  'banking-payments-payment-gateways-api-platforms',
];

async function removeInvalidPaymentCodes() {
  console.log('Finding publications with invalid payment codes...\n');

  // Find publications with these codes in the industries array
  const { data: publications, error: fetchError } = await supabase
    .from('kb_publication')
    .select('id, title, industries')
    .not('industries', 'is', null);

  if (fetchError) {
    console.error('Error fetching publications:', fetchError);
    return;
  }

  console.log(`Checking ${publications.length} publications...\n`);

  const updates = [];

  for (const pub of publications) {
    if (!pub.industries || !Array.isArray(pub.industries)) continue;

    const originalCount = pub.industries.length;
    const cleanedIndustries = pub.industries.filter((code) => !invalidCodes.includes(code));

    if (cleanedIndustries.length < originalCount) {
      const removed = pub.industries.filter((code) => invalidCodes.includes(code));
      updates.push({
        id: pub.id,
        title: pub.title,
        removed: removed,
        originalIndustries: pub.industries,
        cleanedIndustries: cleanedIndustries,
      });
    }
  }

  console.log(`Found ${updates.length} publications with invalid codes\n`);

  if (updates.length === 0) {
    console.log('No invalid codes found. All publications are clean!');
    return;
  }

  // Show what will be updated
  console.log('Publications to update:');
  updates.forEach((update, idx) => {
    console.log(`\n${idx + 1}. ${update.title}`);
    console.log(`   Removing: ${update.removed.join(', ')}`);
    console.log(`   Before: ${update.originalIndustries.length} codes`);
    console.log(`   After: ${update.cleanedIndustries.length} codes`);
  });

  console.log('\n\nStarting updates...\n');

  // Update each publication
  let successCount = 0;
  let errorCount = 0;

  for (const update of updates) {
    const { error } = await supabase
      .from('kb_publication')
      .update({ industries: update.cleanedIndustries })
      .eq('id', update.id);

    if (error) {
      console.error(`✗ Failed to update ${update.title}:`, error.message);
      errorCount++;
    } else {
      console.log(`✓ Updated: ${update.title}`);
      successCount++;
    }
  }

  console.log(`\n\nSummary:`);
  console.log(`  Success: ${successCount}`);
  console.log(`  Errors: ${errorCount}`);
  console.log(`  Total: ${updates.length}`);
}

removeInvalidPaymentCodes().catch(console.error);
