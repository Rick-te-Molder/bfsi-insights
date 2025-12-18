/**
 * Prompt types
 * Represents agent prompts and A/B testing
 */

export interface PromptVersion {
  id: string;
  agent_name: string;
  version: string;
  prompt_text: string;
  model_id?: string;
  stage?: PromptStage;
  is_current: boolean;
  created_at: string;
  notes?: string;
  // Eval status (KB-248)
  last_eval_run_id?: string;
  last_eval_score?: number;
  last_eval_status?: PromptEvalStatus;
  last_eval_at?: string;
}

export type PromptEvalStatus = 'pending' | 'running' | 'passed' | 'warning' | 'failed';

export type PromptStage = 'DEV' | 'TST' | 'PRD';

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
  status: ABTestStatus;
  results?: ABTestResults;
  winner?: ABTestWinner;
  name?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export type ABTestStatus = 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
export type ABTestWinner = 'a' | 'b' | 'tie';

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
