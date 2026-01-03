-- ============================================================================
-- Fix SECURITY DEFINER on pretty views
-- ============================================================================
-- Recreate regulation_obligations_pretty, regulation_pretty, and regulator_pretty
-- with explicit SECURITY INVOKER to ensure RLS policies of the querying user
-- are enforced, not the view creator.
--
-- Supabase Linter Issue: 0010_security_definer_view
-- https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view
-- ============================================================================

-- Drop and recreate regulation_obligations_pretty with SECURITY INVOKER
DROP VIEW IF EXISTS regulation_obligations_pretty;
CREATE VIEW regulation_obligations_pretty
WITH (security_invoker = true) AS
SELECT 
  r.id,
  r.code,
  r.title,
  (jsonb_array_elements(r.obligations) ->> 'text') AS obligation,
  r.domain,
  rg.name AS regulator_name
FROM regulation r
LEFT JOIN regulator rg ON rg.id = r.regulator_id;

COMMENT ON VIEW regulation_obligations_pretty IS 'Regulation obligations flattened view with regulator name';

-- Drop and recreate regulation_pretty with SECURITY INVOKER
DROP VIEW IF EXISTS regulation_pretty;
CREATE VIEW regulation_pretty
WITH (security_invoker = true) AS
SELECT 
  r.id,
  r.code,
  r.title,
  r.instrument_type,
  r.jurisdiction,
  rg.name AS regulator_name,
  r.scope_goals,
  r.status,
  r.effective_from,
  r.effective_to,
  r.obligations,
  r.deadlines,
  r.sources,
  r.notes,
  r.created_at,
  r.updated_at,
  r.regulator_id,
  rg.slug AS regulator_slug,
  rg.website_url AS regulator_website_url,
  rg.jurisdiction AS regulator_jurisdiction,
  r.domain
FROM regulation r
LEFT JOIN regulator rg ON rg.id = r.regulator_id;

COMMENT ON VIEW regulation_pretty IS 'Regulation details with regulator information';

-- Drop and recreate regulator_pretty with SECURITY INVOKER
DROP VIEW IF EXISTS regulator_pretty;
CREATE VIEW regulator_pretty
WITH (security_invoker = true) AS
SELECT 
  id,
  name,
  slug,
  jurisdiction,
  website_url
FROM regulator;

COMMENT ON VIEW regulator_pretty IS 'Regulator summary view';
