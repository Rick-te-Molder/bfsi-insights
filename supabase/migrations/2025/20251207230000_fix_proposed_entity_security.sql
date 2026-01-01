-- KB-178: Fix security issues in proposed_entity workflow
-- Issues:
-- 1. RLS not enabled on proposed_entity table
-- 2. Functions missing search_path setting
-- 3. View using SECURITY DEFINER

-- ============================================================================
-- PART 1: Enable RLS on proposed_entity table
-- ============================================================================

ALTER TABLE proposed_entity ENABLE ROW LEVEL SECURITY;

-- Policy: Service role (agent-api) can do everything
CREATE POLICY "Service role has full access to proposed_entity"
  ON proposed_entity
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can read pending proposals (for admin UI)
CREATE POLICY "Authenticated users can read proposed_entity"
  ON proposed_entity
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated users can update proposals (approve/reject via functions)
-- Note: The actual approve/reject happens via SECURITY DEFINER functions
CREATE POLICY "Authenticated users can update proposed_entity"
  ON proposed_entity
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- PART 2: Fix functions with proper search_path
-- ============================================================================

-- Recreate approve_proposed_entity with search_path set
CREATE OR REPLACE FUNCTION approve_proposed_entity(
  p_proposal_id uuid,
  p_reviewer_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_proposal public.proposed_entity;
  v_new_id bigint;
  v_result jsonb;
BEGIN
  -- Get the proposal
  SELECT * INTO v_proposal FROM public.proposed_entity WHERE id = p_proposal_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Proposal not found');
  END IF;
  
  IF v_proposal.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Proposal already processed');
  END IF;
  
  -- Insert into appropriate table based on entity_type
  CASE v_proposal.entity_type
    WHEN 'regulator' THEN
      INSERT INTO public.regulator (name, slug, jurisdiction, domain, notes)
      VALUES (
        v_proposal.name,
        v_proposal.slug,
        v_proposal.metadata->>'jurisdiction',
        COALESCE(v_proposal.metadata->>'domain', 'bfsi'),
        v_proposal.metadata->>'notes'
      )
      ON CONFLICT (slug) DO NOTHING
      RETURNING id INTO v_new_id;
      
    WHEN 'standard_setter' THEN
      INSERT INTO public.standard_setter (name, slug, website_url, country_code, domain, notes)
      VALUES (
        v_proposal.name,
        v_proposal.slug,
        v_proposal.metadata->>'website_url',
        v_proposal.metadata->>'country_code',
        COALESCE(v_proposal.metadata->>'domain', 'bfsi'),
        v_proposal.metadata->>'notes'
      )
      ON CONFLICT (slug) DO NOTHING
      RETURNING id INTO v_new_id;
      
    WHEN 'bfsi_organization' THEN
      INSERT INTO public.bfsi_organization (name, slug, website_url, country_code, org_type, notes)
      VALUES (
        v_proposal.name,
        v_proposal.slug,
        v_proposal.metadata->>'website_url',
        v_proposal.metadata->>'country_code',
        COALESCE(v_proposal.metadata->>'org_type', 'company'),
        v_proposal.metadata->>'notes'
      )
      ON CONFLICT (slug) DO NOTHING
      RETURNING id INTO v_new_id;
      
    WHEN 'ag_vendor' THEN
      INSERT INTO public.ag_vendor (name, slug, website_url, description)
      VALUES (
        v_proposal.name,
        v_proposal.slug,
        v_proposal.metadata->>'website_url',
        v_proposal.metadata->>'description'
      )
      ON CONFLICT (slug) DO NOTHING
      RETURNING id INTO v_new_id;
      
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Unknown entity type');
  END CASE;
  
  -- Update the proposal status
  UPDATE public.proposed_entity
  SET 
    status = 'approved',
    reviewed_at = now(),
    reviewed_by = p_reviewer_id,
    review_notes = p_notes
  WHERE id = p_proposal_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'entity_type', v_proposal.entity_type,
    'slug', v_proposal.slug,
    'new_id', v_new_id
  );
END;
$$;

-- Recreate reject_proposed_entity with search_path set
CREATE OR REPLACE FUNCTION reject_proposed_entity(
  p_proposal_id uuid,
  p_reviewer_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.proposed_entity
  SET 
    status = 'rejected',
    reviewed_at = now(),
    reviewed_by = p_reviewer_id,
    review_notes = p_notes
  WHERE id = p_proposal_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Proposal not found or already processed');
  END IF;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================================
-- PART 3: Fix view - use SECURITY INVOKER (default, but explicit is better)
-- ============================================================================

-- Drop and recreate view without SECURITY DEFINER
DROP VIEW IF EXISTS pending_entity_proposals;

CREATE VIEW pending_entity_proposals 
WITH (security_invoker = true)
AS
SELECT 
  pe.id,
  pe.entity_type,
  pe.name,
  pe.slug,
  pe.metadata,
  pe.source_url,
  pe.created_at,
  iq.payload->>'title' as source_title
FROM proposed_entity pe
LEFT JOIN ingestion_queue iq ON iq.id = pe.source_queue_id
WHERE pe.status = 'pending'
ORDER BY pe.created_at DESC;

-- Grant access to authenticated users
GRANT SELECT ON pending_entity_proposals TO authenticated;
