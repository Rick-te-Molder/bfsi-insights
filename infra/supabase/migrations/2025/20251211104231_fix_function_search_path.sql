-- ============================================================================
-- Fix function search_path security warnings
-- ============================================================================
-- Supabase linter flags functions without explicit search_path as security risks.
-- Setting search_path = '' prevents search_path injection attacks.

-- Fix get_status_code_counts
ALTER FUNCTION public.get_status_code_counts() SET search_path = '';

-- Fix update_updated_at_column
ALTER FUNCTION public.update_updated_at_column() SET search_path = '';

-- Fix get_ab_test_variant
ALTER FUNCTION public.get_ab_test_variant(text) SET search_path = '';

-- Fix approve_from_queue (current signature with optional params)
ALTER FUNCTION public.approve_from_queue(uuid, text[], text[]) SET search_path = '';
