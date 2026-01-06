import process from 'node:process';

export function applyEnvShim() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const publicUrl = process.env.PUBLIC_SUPABASE_URL;

  if (supabaseUrl && !publicUrl) {
    process.env.PUBLIC_SUPABASE_URL = supabaseUrl;
  }

  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  const publicAnonKey = process.env.PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseAnonKey && !publicAnonKey) {
    process.env.PUBLIC_SUPABASE_ANON_KEY = supabaseAnonKey;
  }
}

applyEnvShim();
