-- ============================================================================
-- Migration: Add admin policies for prompt_ab_test tables
-- ============================================================================
-- Problem: prompt_ab_test only has service_role policies, admins can't create tests
-- Solution: Add policies using is_app_admin() function (created in previous migration)
-- ============================================================================

-- Add admin policies for prompt_ab_test
CREATE POLICY "Admins can view prompt_ab_test" ON prompt_ab_test
  FOR SELECT TO authenticated
  USING (is_app_admin());

CREATE POLICY "Admins can insert prompt_ab_test" ON prompt_ab_test
  FOR INSERT TO authenticated
  WITH CHECK (is_app_admin());

CREATE POLICY "Admins can update prompt_ab_test" ON prompt_ab_test
  FOR UPDATE TO authenticated
  USING (is_app_admin())
  WITH CHECK (is_app_admin());

CREATE POLICY "Admins can delete prompt_ab_test" ON prompt_ab_test
  FOR DELETE TO authenticated
  USING (is_app_admin());

-- Add admin policies for prompt_ab_test_item
CREATE POLICY "Admins can view prompt_ab_test_item" ON prompt_ab_test_item
  FOR SELECT TO authenticated
  USING (is_app_admin());

CREATE POLICY "Admins can insert prompt_ab_test_item" ON prompt_ab_test_item
  FOR INSERT TO authenticated
  WITH CHECK (is_app_admin());

CREATE POLICY "Admins can update prompt_ab_test_item" ON prompt_ab_test_item
  FOR UPDATE TO authenticated
  USING (is_app_admin())
  WITH CHECK (is_app_admin());

CREATE POLICY "Admins can delete prompt_ab_test_item" ON prompt_ab_test_item
  FOR DELETE TO authenticated
  USING (is_app_admin());
