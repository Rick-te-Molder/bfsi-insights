/**
 * Source types
 * Represents content sources (publications, blogs, news sites)
 */

export interface Source {
  slug: string;
  name: string;
  domain: string;
  tier: SourceTier;
  category: string;
  channel_slug?: string;
  description?: string;
  rss_feed?: string;
  sitemap_url?: string;
  scraper_config?: Record<string, unknown>;
  enabled: boolean;
  sort_order: number;
  show_on_external_page: boolean;
  disabled_reason?: string;
  created_at?: string;
  updated_at?: string;
}

export type SourceTier = 'standard' | 'premium';
