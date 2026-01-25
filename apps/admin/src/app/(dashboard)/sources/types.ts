export type FilterTier = 'all' | 'standard' | 'premium';
export type FilterEnabled = 'all' | 'true' | 'false';
export type FilterHealth = 'all' | 'healthy' | 'warning' | 'error' | 'inactive';

export interface SourceHealth {
  source_slug: string;
  last_discovery: string | null;
  items_7d: number;
  items_30d: number;
  failed_7d: number;
  error_rate: number;
  health_status: 'healthy' | 'warning' | 'error' | 'inactive';
}
