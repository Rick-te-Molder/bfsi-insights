// Core types for admin UI
// These mirror the Supabase schema

export interface QueueItem {
  id: string;
  url: string;
  url_norm: string;
  status: 'pending' | 'queued' | 'processing' | 'enriched' | 'approved' | 'rejected' | 'failed';
  content_type: string;
  payload: QueuePayload;
  created_at: string;
  updated_at: string;
  source_slug?: string;
}

export interface QueuePayload {
  title?: string;
  published_at?: string;
  summary?: {
    short?: string;
    medium?: string;
    long?: string;
  };
  long_summary_sections?: SummarySection[];
  industry_codes?: string[];
  topic_codes?: string[];
  vendor_names?: string[];
  organization_names?: string[];
  geography_codes?: string[];
  regulator_codes?: string[];
  regulation_codes?: string[];
  persona_scores?: Record<string, number>;
  relevance_confidence?: number;
  rejection_reason?: string;
  thumbnail_url?: string;
  raw_content?: string;
  content_length?: number;
  enrichment_log?: EnrichmentLogEntry[];
}

export interface SummarySection {
  heading: string;
  content: string;
}

export interface EnrichmentLogEntry {
  agent: string;
  timestamp: string;
  duration_ms: number;
  model?: string;
  prompt_version?: string;
  input_tokens?: number;
  output_tokens?: number;
  success: boolean;
  error?: string;
}

export interface Publication {
  id: string;
  slug: string;
  title: string;
  source_url: string;
  source_slug: string;
  published_at: string;
  summary_short: string;
  summary_medium: string;
  summary_long: string;
  thumbnail_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Source {
  slug: string;
  name: string;
  domain: string;
  tier: 'standard' | 'premium';
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

export interface PromptVersion {
  id: number;
  agent_name: string;
  version: string;
  prompt_text: string;
  model_id?: string;
  stage?: string;
  is_current: boolean;
  created_at: string;
  notes?: string;
}

export interface EvalRun {
  id: string;
  agent_name: string;
  prompt_version: string;
  model_id: string;
  created_at: string;
  total_items: number;
  passed: number;
  failed: number;
  scores: Record<string, number>;
  notes?: string;
}

// UI-specific types
export type FilterStatus = 'all' | QueueItem['status'];

export interface TableFilters {
  status: FilterStatus;
  source?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}
