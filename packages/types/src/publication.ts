/**
 * Publication types
 * Represents published content on the knowledge base
 */

/**
 * Publication as stored in kb_publication table
 */
export interface Publication {
  id: string;
  slug: string;
  title: string;
  source_url: string;
  source_slug: string;
  date_published?: string;
  summary_short?: string;
  summary_medium?: string;
  summary_long?: string;
  thumbnail_url?: string;
  status: PublicationStatus;
  created_at: string;
  updated_at: string;
}

export type PublicationStatus = 'draft' | 'published' | 'archived';

/**
 * Publication with joined data from kb_publication_pretty view
 * Used for display on the public site
 */
export interface PublicationPretty {
  id: string;
  slug: string;
  title: string;
  authors: string[];
  url: string;
  source_name: string | null;
  date_published: string | null;
  date_added: string | null;
  last_edited: string | null;
  thumbnail: string | null;
  thumbnail_bucket?: string | null;
  thumbnail_path?: string | null;

  summary_short: string | null;
  summary_medium: string | null;
  summary_long: string | null;

  audience: string | null;
  audiences?: string[];
  content_type: string | null;
  geography: string | null;
  geographies?: string[];

  industry: string | null;
  topic: string | null;
  industries?: string[];
  topics?: string[];
  processes?: string[];
  regulators?: string[];
  regulations?: string[];
  obligations?: string[];

  use_cases: string | null;
  agentic_capabilities: string | null;

  status: string;
}
