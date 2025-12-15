// Core types for admin UI
// KB-238: Shared types are now imported from @bfsi/types
// This file re-exports them and adds admin-specific types

export type {
  // Ingestion Queue
  IngestionQueueItem,
  QueuePayload,
  SummarySection,
  EnrichmentLogEntry,
  NewIngestionQueueItem,
  // Publication
  Publication,
  PublicationPretty,
  PublicationStatus,
  // Source
  Source,
  SourceTier,
  // Prompt
  PromptVersion,
  PromptStage,
  PromptABTest,
  ABTestStatus,
  ABTestWinner,
  ABTestResults,
  ABTestMetrics,
  PromptABTestItem,
  // Eval
  EvalRun,
  EvalType,
  EvalStatus,
  EvalGoldenSet,
  EvalResult,
  // Status
  StatusLookup,
  StatusPhase,
  StatusCode,
} from '@bfsi/types';

export { STATUS_CODES } from '@bfsi/types';

// Legacy alias for backward compatibility
// TODO: Migrate usages to IngestionQueueItem
import type { IngestionQueueItem } from '@bfsi/types';
export type QueueItem = IngestionQueueItem;

// UI-specific types
// Note: IngestionQueueItem uses status_code (number), not status (string)
// This type is for UI filter state only
export type FilterStatus = 'all' | 'pending' | 'enriched' | 'approved' | 'rejected' | 'failed';

export interface TableFilters {
  status: FilterStatus;
  source?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}
