import { env } from '../config/env.js';
import {
  getSupabaseAdminClient,
  getSupabaseAnonClient,
  resetSupabaseClientsForTests,
} from '../clients/supabase.js';

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let supabase = null;

function getSupabaseKey() {
  return env.SUPABASE_SERVICE_KEY || env.SUPABASE_ANON_KEY || null;
}

export function getSupabase() {
  if (supabase) return supabase;

  const key = getSupabaseKey();

  if (!env.SUPABASE_URL || !key) {
    throw new Error(
      'CRITICAL: Supabase env vars missing. Required: PUBLIC_SUPABASE_URL and (SUPABASE_SERVICE_KEY or PUBLIC_SUPABASE_ANON_KEY).',
    );
  }

  supabase = env.SUPABASE_SERVICE_KEY ? getSupabaseAdminClient() : getSupabaseAnonClient();
  return supabase;
}

export function resetSupabaseForTests() {
  supabase = null;
  resetSupabaseClientsForTests();
}
