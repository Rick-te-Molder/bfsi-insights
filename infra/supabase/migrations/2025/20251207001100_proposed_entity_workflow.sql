-- Proposed Entity Workflow
-- Stores entities discovered by agent-api that need admin approval before being added to lookup tables

-- ============================================================================
-- PART 1: Create proposed_entity table
-- ============================================================================

CREATE TABLE IF NOT EXISTS proposed_entity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What type of entity is being proposed
  entity_type text NOT NULL CHECK (entity_type IN (
    'regulator',
    'standard_setter', 
    'bfsi_organization',
    'ag_vendor',
    'regulation'
  )),
  
  -- Proposed values
  name text NOT NULL,
  slug text NOT NULL,
  
  -- Additional metadata (varies by entity type)
  metadata jsonb DEFAULT '{}',
  
  -- Source context: which queue item triggered this proposal
  source_queue_id uuid REFERENCES ingestion_queue(id) ON DELETE SET NULL,
  source_url text,
  
  -- Workflow
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'duplicate')),
  
  -- Review info
  reviewed_at timestamptz,
  reviewed_by uuid,
  review_notes text,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Prevent duplicate pending proposals (partial unique index)
CREATE UNIQUE INDEX idx_proposed_entity_unique_pending 
  ON proposed_entity(entity_type, slug) 
  WHERE status = 'pending';

-- Index for quick lookups
CREATE INDEX idx_proposed_entity_status ON proposed_entity(status);
CREATE INDEX idx_proposed_entity_type_status ON proposed_entity(entity_type, status);
CREATE INDEX idx_proposed_entity_source ON proposed_entity(source_queue_id);

-- Trigger for updated_at
CREATE TRIGGER trg_proposed_entity_updated_at
  BEFORE UPDATE ON proposed_entity
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- PART 2: Function to approve a proposed entity
-- ============================================================================

CREATE OR REPLACE FUNCTION approve_proposed_entity(
  p_proposal_id uuid,
  p_reviewer_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_proposal proposed_entity;
  v_new_id bigint;
  v_result jsonb;
BEGIN
  -- Get the proposal
  SELECT * INTO v_proposal FROM proposed_entity WHERE id = p_proposal_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Proposal not found');
  END IF;
  
  IF v_proposal.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Proposal already processed');
  END IF;
  
  -- Insert into appropriate table based on entity_type
  CASE v_proposal.entity_type
    WHEN 'regulator' THEN
      INSERT INTO regulator (name, slug, jurisdiction, domain, notes)
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
      INSERT INTO standard_setter (name, slug, website_url, country_code, domain, notes)
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
      INSERT INTO bfsi_organization (name, slug, website_url, country_code, org_type, notes)
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
      INSERT INTO ag_vendor (name, slug, website_url, description)
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
  UPDATE proposed_entity
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

-- ============================================================================
-- PART 3: Function to reject a proposed entity
-- ============================================================================

CREATE OR REPLACE FUNCTION reject_proposed_entity(
  p_proposal_id uuid,
  p_reviewer_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE proposed_entity
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
-- PART 4: View for pending proposals with context
-- ============================================================================

CREATE OR REPLACE VIEW pending_entity_proposals AS
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

COMMENT ON TABLE proposed_entity IS 'Entities proposed by agent-api that need admin approval before adding to lookup tables';
