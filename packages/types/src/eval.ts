/**
 * Evaluation types
 * Represents agent evaluation runs and results
 */

export interface EvalRun {
  id: string;
  agent_name: string;
  prompt_version: string;
  eval_type: EvalType;
  golden_set_id?: string;
  compare_prompt_version?: string;
  status: EvalStatus;
  total_examples?: number;
  passed?: number;
  failed?: number;
  score?: number;
  results?: Record<string, unknown>;
  started_at: string;
  finished_at?: string;
  duration_ms?: number;
}

export type EvalType = 'golden' | 'llm_judge' | 'ab_test';
export type EvalStatus = 'running' | 'success' | 'failed';

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
