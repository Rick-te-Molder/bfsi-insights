#!/usr/bin/env node
/**
 * @script check-geography-codes.mjs
 * @safety SAFE - read-only diagnostic
 * @env    local, staging, prod
 *
 * @description
 * Lists all geography codes from kb_geography table, grouped by level.
 * Useful for verifying taxonomy consistency.
 *
 * @sideEffects None (read-only)
 *
 * @usage
 *   node scripts/ops/check-geography-codes.mjs
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.PUBLIC_SUPABASE_ANON_KEY,
);

async function checkGeographyCodes() {
  console.log('Checking geography codes in kb_geography...\n');

  const { data, error } = await supabase
    .from('kb_geography')
    .select('code, name, level, parent_code')
    .order('level')
    .order('code');

  if (error) {
    console.error('Error querying geography:', error);
    return;
  }

  console.log(`Found ${data.length} geography codes:\n`);

  // Group by level
  const byLevel = {};
  data.forEach((item) => {
    if (!byLevel[item.level]) byLevel[item.level] = [];
    byLevel[item.level].push(item);
  });

  Object.keys(byLevel)
    .sort((a, b) => a.localeCompare(b))
    .forEach((level) => {
      console.log(`\nLevel ${level}:`);
      byLevel[level].forEach((item) => {
        console.log(`  ${item.code} - ${item.name} (parent: ${item.parent_code || 'none'})`);
      });
    });
}

await checkGeographyCodes().catch(console.error);
