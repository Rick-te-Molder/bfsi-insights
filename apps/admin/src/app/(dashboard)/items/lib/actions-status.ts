import { createServiceRoleClient } from '@/lib/supabase/server';

type Supabase = ReturnType<typeof createServiceRoleClient>;

type StatusRow = {
  code: number;
  name: string;
};

export async function getStatusCode(supabase: Supabase, name: string): Promise<number> {
  const { data, error } = await supabase
    .from('status_lookup')
    .select('code')
    .eq('name', name)
    .single();
  if (error || !data) throw new Error(`Status code not found: ${name}`);
  return data.code;
}

export async function getStatusCodes(
  supabase: Supabase,
  names: string[],
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('status_lookup')
    .select('code, name')
    .in('name', names);
  if (error || !data)
    throw new Error(`Failed to load status codes: ${error?.message ?? 'no data returned'}`);

  const codes: Record<string, number> = {};
  for (const row of data as StatusRow[]) {
    codes[row.name] = row.code;
  }

  for (const name of names) {
    if (!codes[name]) throw new Error(`Status code not found: ${name}`);
  }

  return codes;
}
