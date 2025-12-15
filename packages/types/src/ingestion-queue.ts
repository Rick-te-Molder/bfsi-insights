/**
 * Ingestion Queue types
 * Represents items flowing through the discovery/enrichment pipeline
 */

export interface IngestionQueueItem {
  id: string;
  url: string;
  url_norm: string;
  content_type: string;
  content_hash?: string;
  status_code: number;
  payload: QueuePayload;
  source_slug?: string;
  discovered_at: string;
  created_at: string;
  updated_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
}

export interface QueuePayload {
  title?: string;
  published_at?: string;
  source?: string;

  // Summaries
  summary?: {
    short?: string;
    medium?: string;
    long?: string;
  };
  long_summary_sections?: SummarySection[];

  // Taxonomy codes
  industry_codes?: string[];
  topic_codes?: string[];
  geography_codes?: string[];
  regulator_codes?: string[];
  regulation_codes?: string[];
  process_codes?: string[];
  obligation_codes?: string[];

  // Entities
  vendor_names?: string[];
  organization_names?: string[];

  // Scoring
  audience_scores?: Record<string, number>;
  relevance_confidence?: number;

  // Review
  rejection_reason?: string;

  // Content
  thumbnail_url?: string;
  raw_content?: string;
  content_length?: number;

  // Logging
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

/**
 * New item to be inserted into ingestion_queue
 */
export type NewIngestionQueueItem = Omit<IngestionQueueItem, 'id' | 'created_at' | 'updated_at'>;
