/**
 * Load writing rules from database
 */

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function loadWritingRules(supabase) {
  const { data: rules } = await supabase
    .from('writing_rules')
    .select('category, rule_name, rule_text')
    .eq('is_active', true)
    .order('priority', { ascending: false });

  if (!rules?.length) return '';

  const grouped = rules.reduce((acc, r) => {
    if (!acc[r.category]) acc[r.category] = [];
    acc[r.category].push(`• ${r.rule_name}: ${r.rule_text}`);
    return acc;
  }, /** @type {Record<string, string[]>} */ ({}));

  return Object.entries(grouped)
    .map(([cat, items]) => `## ${cat.toUpperCase()} RULES\n${items.join('\n')}`)
    .join('\n\n');
}
