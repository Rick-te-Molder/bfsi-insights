import { createServiceRoleClient } from '@/lib/supabase/server';

type Supabase = ReturnType<typeof createServiceRoleClient>;

export async function fetchQueueItem<T extends string>(supabase: Supabase, id: string, select: T) {
  return supabase.from('ingestion_queue').select(select).eq('id', id).single();
}

export async function updateQueueItem(
  supabase: Supabase,
  id: string,
  patch: Record<string, unknown>,
) {
  return supabase.from('ingestion_queue').update(patch).eq('id', id);
}

export function coercePayload(payload: unknown): Record<string, unknown> {
  return (payload ?? {}) as Record<string, unknown>;
}

export function mergePayload(payload: Record<string, unknown>, patch: Record<string, unknown>) {
  return { ...payload, ...patch };
}
