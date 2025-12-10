/**
 * Shared types for dynamic taxonomy display
 */

export interface TaxonomyItem {
  code: string;
  name: string;
}

export interface TaxonomyConfig {
  slug: string;
  display_name: string;
  display_order: number;
  behavior_type: 'guardrail' | 'expandable' | 'scoring';
  source_table: string | null;
  payload_field: string;
  color: string;
  score_parent_slug: string | null;
  score_threshold: number | null;
}

// Dynamic taxonomy data keyed by slug
export type TaxonomyData = Record<string, TaxonomyItem[]>;

// Payload with dynamic tag fields
export type TagPayload = Record<string, unknown>;
