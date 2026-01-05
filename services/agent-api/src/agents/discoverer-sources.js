async function buildBaseQuery(supabase) {
  return supabase
    .from('kb_source')
    .select(
      'slug, name, domain, tier, category, rss_feed, sitemap_url, scraper_config, premium_config',
    )
    .eq('enabled', true)
    .or('rss_feed.not.is.null,sitemap_url.not.is.null,scraper_config.not.is.null')
    .order('sort_order');
}

export async function loadSources(supabase, sourceSlug, includePremium = false) {
  let query = await buildBaseQuery(supabase);

  if (sourceSlug) query = query.eq('slug', sourceSlug);
  else if (!includePremium) query = query.neq('tier', 'premium');

  const { data: sources, error } = await query;
  if (error) throw error;
  return sources || [];
}

export async function logSkippedPremiumSources(supabase, sourceSlug, includePremium) {
  if (sourceSlug || includePremium) return;

  const { data: premiumSources } = await supabase
    .from('kb_source')
    .select('name')
    .eq('enabled', true)
    .eq('tier', 'premium');

  if (!premiumSources?.length) return;

  console.log(`ℹ️  Skipping ${premiumSources.length} premium sources (use --premium to include):`);
  console.log(`   ${premiumSources.map((s) => s.name).join(', ')}`);
}
