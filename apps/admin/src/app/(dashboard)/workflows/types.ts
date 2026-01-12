/**
 * Types for workflow dashboard components
 */

export type StatusSummary = {
  status_code: number;
  status_name: string;
  category: string;
  item_count: number;
  failed_count: number;
  pending_retry_count: number;
  avg_age_hours: number;
};

export type StepFailureRate = {
  step_name: string;
  total_runs: number;
  succeeded: number;
  failed: number;
  failure_rate_pct: number;
  avg_duration_seconds: number;
};

export type StuckItem = {
  id: string;
  url: string;
  status_code: number;
  status_name: string;
  last_failed_step: string | null;
  last_error_message: string | null;
  failure_count: number;
  stuck_hours: number;
};
