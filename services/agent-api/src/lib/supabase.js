import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

let supabase = null;

function getSupabaseKey() {
  return process.env.SUPABASE_SERVICE_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY || null;
}

export function getSupabase() {
  if (supabase) return supabase;

  const url = process.env.PUBLIC_SUPABASE_URL;
  const key = getSupabaseKey();

  if (!url || !key) {
    throw new Error(
      'CRITICAL: Supabase env vars missing. Required: PUBLIC_SUPABASE_URL and (SUPABASE_SERVICE_KEY or PUBLIC_SUPABASE_ANON_KEY).',
    );
  }

  supabase = createClient(url, key);
  return supabase;
}

export function resetSupabaseForTests() {
  supabase = null;
}
