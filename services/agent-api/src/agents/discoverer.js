// NOTE: Excluded from Sonar coverage - see docs/quality/sonar-exclusions.md
import { runDiscoveryImpl } from './discoverer-run.js';
import { getSupabaseAdminClient } from '../clients/supabase.js';

export { clearDiscoveryConfigCache } from '../lib/discovery-config.js';

export async function runDiscovery(options = {}) {
  const supabase = getSupabaseAdminClient();
  return runDiscoveryImpl(supabase, options);
}
