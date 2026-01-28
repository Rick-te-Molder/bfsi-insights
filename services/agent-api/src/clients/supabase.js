import { createClient } from '@supabase/supabase-js';

import { env } from '../config/env.js';

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let adminClient = null;
/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let anonClient = null;

export function getSupabaseAdminClient() {
  if (adminClient) return adminClient;

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    throw new Error('Missing Supabase environment variables');
  }

  console.log('[Supabase] Initializing admin client with URL:', env.SUPABASE_URL);
  adminClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  return adminClient;
}

export function getSupabaseAnonClient() {
  if (anonClient) return anonClient;

  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase environment variables');
  }

  anonClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  return anonClient;
}

export function resetSupabaseClientsForTests() {
  adminClient = null;
  anonClient = null;
}
