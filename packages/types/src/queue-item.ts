/**
 * KB-277: Centralized types for ingestion queue items
 * Used by Review Queue, Dashboard, and other admin components
 */

export interface QueueItem {
  id: string;
  url: string;
  status_code: number;
  payload: QueueItemPayload;
  discovered_at: string;
  entry_type?: 'manual' | 'discovered';
  // Error tracking fields
  failure_count?: number;
  last_failed_step?: string;
  last_error_message?: string;
  last_error_at?: string;
  error_type?: string;
  error_retryable?: boolean;
}

export interface QueueItemPayload {
  title?: string;
  summary?: {
    short?: string;
    medium?: string;
    long?: string;
  };
  rejection_reason?: string;
  source_slug?: string;
  source_name?: string;
  date_published?: string;
  published_at?: string;
  audiences?: string[];
  geographies?: string[];
  topics?: string[];
  industry_codes?: string[];
  geography_codes?: string[];
  topic_codes?: string[];
  use_case_codes?: string[];
  capability_codes?: string[];
  regulator_codes?: string[];
  regulation_codes?: string[];
  process_codes?: string[];
  organization_names?: string[];
  vendor_names?: string[];
  // KB-230: Dynamic audience scores - keys come from kb_audience table
  audience_scores?: Record<string, number>;
  // Additional fields
  textContent?: string;
  description?: string;
  author?: string;
  authors?: string[];
  key_takeaways?: string[];
  long_summary_sections?: Array<{ heading: string; content: string }>;
  key_figures?: Array<{ figure: string; context: string }>;
  entities?: {
    organizations?: Array<{ name: string; role?: string }>;
    people?: Array<{ name: string; role?: string }>;
  };
  is_academic?: boolean;
  citations?: Array<{ title: string; authors?: string[]; year?: number }>;
  thumbnail_bucket?: string;
  thumbnail_path?: string;
  thumbnail_url?: string;
  tagging_metadata?: {
    overall_confidence?: number;
    reasoning?: string;
    tagged_at?: string;
  };
  // Additional metadata fields
  relevance_confidence?: number;
  content_length?: number;
  [key: string]: unknown; // Allow additional dynamic fields
}

// Status labels - maps status codes to human-readable labels
// Note: STATUS_CODES constants are in ./status.ts
export const QUEUE_STATUS_LABELS: Record<number, string> = {
  200: 'Pending Enrichment',
  210: 'To Summarize',
  211: 'Summarizing',
  220: 'To Tag',
  221: 'Tagging',
  230: 'To Thumbnail',
  231: 'Thumbnailing',
  240: 'Enriched',
  300: 'Pending Review',
  310: 'In Review',
  320: 'Editing',
  330: 'Approved',
  400: 'Published',
  500: 'Failed',
  530: 'Irrelevant',
  540: 'Rejected',
  599: 'Dead Letter',
};

export function getQueueStatusLabel(code: number): string {
  return QUEUE_STATUS_LABELS[code] || `Status ${code}`;
}
