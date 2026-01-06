import process from 'node:process';

export const env = {
  SUPABASE_URL: process.env.SUPABASE_URL ?? process.env.PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? process.env.PUBLIC_SUPABASE_ANON_KEY,
};
