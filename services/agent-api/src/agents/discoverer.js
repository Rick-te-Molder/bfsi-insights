// NOTE: Excluded from Sonar coverage - see docs/quality/sonar-exclusions.md
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { runDiscoveryImpl } from './discoverer-run.js';

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_KEY ?? '',
);

export { clearDiscoveryConfigCache } from '../lib/discovery-config.js';

export async function runDiscovery(options = {}) {
  return runDiscoveryImpl(supabase, options);
}
