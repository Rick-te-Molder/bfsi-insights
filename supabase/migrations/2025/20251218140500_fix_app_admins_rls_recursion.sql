-- ============================================================================
-- Migration: Fix infinite recursion in app_admins RLS policies
-- ============================================================================
-- Problem: app_admins policies queried app_admins itself to check admin status,
-- causing infinite recursion when prompt_version policies also queried app_admins.
-- Solution: Create a SECURITY DEFINER function that bypasses RLS.
-- ============================================================================

-- Create security definer function to check admin status without RLS recursion
CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM app_admins WHERE user_id = auth.uid()
  )
$$;

-- Drop the recursive policies on app_admins
DROP POLICY IF EXISTS "Admins can insert app_admins" ON app_admins;
DROP POLICY IF EXISTS "Admins can update app_admins" ON app_admins;
DROP POLICY IF EXISTS "Admins can view app_admins" ON app_admins;

-- Ensure service role and self-check policies exist
DROP POLICY IF EXISTS "Service role full access on app_admins" ON app_admins;
CREATE POLICY "Service role full access on app_admins" ON app_admins
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can check their own admin status" ON app_admins;
CREATE POLICY "Users can check their own admin status" ON app_admins
  FOR SELECT TO authenticated 
  USING (user_id = auth.uid());

-- Fix prompt_version policies to use the security definer function
DROP POLICY IF EXISTS "Admins can delete prompt_versions" ON prompt_version;
DROP POLICY IF EXISTS "Admins can insert prompt_versions" ON prompt_version;
DROP POLICY IF EXISTS "Admins can update prompt_versions" ON prompt_version;

CREATE POLICY "Admins can insert prompt_versions" ON prompt_version
  FOR INSERT TO authenticated 
  WITH CHECK (is_app_admin());

CREATE POLICY "Admins can update prompt_versions" ON prompt_version
  FOR UPDATE TO authenticated 
  USING (is_app_admin()) 
  WITH CHECK (is_app_admin());

CREATE POLICY "Admins can delete prompt_versions" ON prompt_version
  FOR DELETE TO authenticated 
  USING (is_app_admin());
