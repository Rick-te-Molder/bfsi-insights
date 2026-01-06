import process from 'node:process';

export const env = {
  get SUPABASE_URL() {
    return process.env.SUPABASE_URL ?? process.env.PUBLIC_SUPABASE_URL;
  },
  get SUPABASE_SERVICE_KEY() {
    return process.env.SUPABASE_SERVICE_KEY;
  },
  get SUPABASE_ANON_KEY() {
    return process.env.SUPABASE_ANON_KEY ?? process.env.PUBLIC_SUPABASE_ANON_KEY;
  },
};
