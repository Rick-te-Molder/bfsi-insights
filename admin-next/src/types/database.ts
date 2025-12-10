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
  audience_scores?: Record<string, number>;
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
  eval_type: 'golden' | 'llm_judge' | 'ab_test';
  golden_set_id?: string;
  compare_prompt_version?: string;
  status: 'running' | 'success' | 'failed';
  total_examples?: number;
  passed?: number;
  failed?: number;
  score?: number;
  results?: Record<string, unknown>;
  started_at: string;
  finished_at?: string;
  duration_ms?: number;
}

export interface EvalGoldenSet {
  id: string;
  agent_name: string;
  name: string;
  description?: string;
  input: Record<string, unknown>;
  expected_output: Record<string, unknown>;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface EvalResult {
  id: string;
  run_id: string;
  input: Record<string, unknown>;
  expected_output?: Record<string, unknown>;
  actual_output?: Record<string, unknown>;
  passed?: boolean;
  score?: number;
  judge_reasoning?: string;
  judge_model?: string;
  output_a?: Record<string, unknown>;
  output_b?: Record<string, unknown>;
  winner?: 'a' | 'b' | 'tie';
  created_at: string;
}

export interface PromptABTest {
  id: string;
  agent_name: string;
  variant_a_version: string;
  variant_b_version: string;
  traffic_split: number;
  sample_size: number;
  items_processed: number;
  items_variant_a: number;
  items_variant_b: number;
  status: 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
  results?: ABTestResults;
  winner?: 'a' | 'b' | 'tie';
  name?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface ABTestResults {
  variant_a: ABTestMetrics;
  variant_b: ABTestMetrics;
  statistical_significance?: number;
}

export interface ABTestMetrics {
  avg_confidence: number;
  avg_latency_ms: number;
  error_rate: number;
  validation_pass_rate: number;
  total_items: number;
}

export interface PromptABTestItem {
  id: string;
  test_id: string;
  queue_item_id?: string;
  variant: 'a' | 'b';
  output?: Record<string, unknown>;
  latency_ms?: number;
  input_tokens?: number;
  output_tokens?: number;
  confidence?: number;
  error_count: number;
  validation_passed?: boolean;
  created_at: string;
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
