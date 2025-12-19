/**
 * Check geography codes in database
 */
/* eslint-env node */
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
    .sort()
    .forEach((level) => {
      console.log(`\nLevel ${level}:`);
      byLevel[level].forEach((item) => {
        console.log(`  ${item.code} - ${item.name} (parent: ${item.parent_code || 'none'})`);
      });
    });
}

checkGeographyCodes().catch(console.error);
