import { getSupabaseAdminClient } from '../clients/supabase.js';

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let supabase = null;

function getSupabase() {
  if (supabase) return supabase;
  supabase = getSupabaseAdminClient();
  return supabase;
}

/** @param {number} limit */
export async function loadUndiscoveredClassics(limit) {
  const { data, error } = await getSupabase()
    .from('classic_papers')
    .select('*')
    .eq('discovered', false)
    .order('created_at')
    .limit(limit);

  if (error) throw error;
  return data || [];
}

/** @param {string} classicId @param {string} semanticScholarId */
export async function markClassicDiscovered(classicId, semanticScholarId) {
  await getSupabase()
    .from('classic_papers')
    .update({
      discovered: true,
      discovered_at: new Date().toISOString(),
      semantic_scholar_id: semanticScholarId,
    })
    .eq('id', classicId);
}

/** @param {string} classicId @param {number} citationCount */
export async function updateClassicCitations(classicId, citationCount) {
  await getSupabase()
    .from('classic_papers')
    .update({ citation_count: citationCount })
    .eq('id', classicId);
}

/** @param {string | null | undefined} url */
export async function urlExists(url) {
  if (!url) return true;

  const { data: queueItem } = await getSupabase()
    .from('ingestion_queue')
    .select('id')
    .eq('url', url)
    .single();

  if (queueItem) return true;

  const { data: pub } = await getSupabase()
    .from('kb_publication')
    .select('id')
    .eq('url', url)
    .single();
  return !!pub;
}

/** @param {Record<string, any>} row */
export async function insertQueueItem(row) {
  return getSupabase().from('ingestion_queue').insert(row).select('id').single();
}
