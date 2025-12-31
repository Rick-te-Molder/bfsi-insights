-- Standardize all entity tables to use:
-- 1. id (uuid) as primary key
-- 2. slug (text, unique) as stable identifier
-- 3. name (text) as display name

-- This migration handles:
-- - Add slug to bfsi_organization and ag_vendor
-- - Convert regulator.id and standard_setter.id from bigint to uuid
-- - Update all foreign key references

BEGIN;

-- ============================================================================
-- PART 1: Add slug to bfsi_organization
-- ============================================================================

-- Add slug column
ALTER TABLE bfsi_organization ADD COLUMN IF NOT EXISTS slug text;

-- Generate slugs from organization_name (lowercase, replace spaces with hyphens)
UPDATE bfsi_organization
SET slug = lower(regexp_replace(organization_name, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;

-- Make slug NOT NULL and UNIQUE
ALTER TABLE bfsi_organization ALTER COLUMN slug SET NOT NULL;
ALTER TABLE bfsi_organization ADD CONSTRAINT bfsi_organization_slug_unique UNIQUE (slug);

-- Rename organization_name to name for consistency
ALTER TABLE bfsi_organization RENAME COLUMN organization_name TO name;

-- ============================================================================
-- PART 2: Add slug to ag_vendor
-- ============================================================================

-- Add slug column
ALTER TABLE ag_vendor ADD COLUMN IF NOT EXISTS slug text;

-- Generate slugs from name (lowercase, replace spaces with hyphens)
UPDATE ag_vendor
SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;

-- Make slug NOT NULL and UNIQUE
ALTER TABLE ag_vendor ALTER COLUMN slug SET NOT NULL;
ALTER TABLE ag_vendor ADD CONSTRAINT ag_vendor_slug_unique UNIQUE (slug);

-- ============================================================================
-- PART 3: Convert regulator.id from bigint to uuid
-- ============================================================================

-- Create temporary mapping table for regulator
CREATE TEMP TABLE regulator_id_mapping (
  old_id bigint PRIMARY KEY,
  new_id uuid DEFAULT gen_random_uuid()
);

-- Populate mapping with existing regulator IDs
INSERT INTO regulator_id_mapping (old_id)
SELECT id FROM regulator;

-- Add new uuid column to regulator
ALTER TABLE regulator ADD COLUMN id_new uuid;

-- Populate new IDs from mapping
UPDATE regulator r
SET id_new = m.new_id
FROM regulator_id_mapping m
WHERE r.id = m.old_id;

-- Update foreign key references in regulation table
ALTER TABLE regulation ADD COLUMN regulator_id_new uuid;

UPDATE regulation reg
SET regulator_id_new = m.new_id
FROM regulator_id_mapping m
WHERE reg.regulator_id = m.old_id;

-- Update foreign key references in standard table
ALTER TABLE standard ADD COLUMN regulator_id_new uuid;

UPDATE standard s
SET regulator_id_new = m.new_id
FROM regulator_id_mapping m
WHERE s.regulator_id = m.old_id;

-- Drop old foreign key constraints
ALTER TABLE regulation DROP CONSTRAINT IF EXISTS regulation_regulator_id_fkey;
ALTER TABLE standard DROP CONSTRAINT IF EXISTS standard_regulator_id_fkey;

-- Drop old columns
ALTER TABLE regulation DROP COLUMN regulator_id;
ALTER TABLE standard DROP COLUMN regulator_id;
ALTER TABLE regulator DROP CONSTRAINT regulator_pkey;
ALTER TABLE regulator DROP COLUMN id;

-- Rename new columns to original names
ALTER TABLE regulator RENAME COLUMN id_new TO id;
ALTER TABLE regulation RENAME COLUMN regulator_id_new TO regulator_id;
ALTER TABLE standard RENAME COLUMN regulator_id_new TO regulator_id;

-- Add primary key and foreign key constraints
ALTER TABLE regulator ADD PRIMARY KEY (id);
ALTER TABLE regulation ADD CONSTRAINT regulation_regulator_id_fkey 
  FOREIGN KEY (regulator_id) REFERENCES regulator(id);
ALTER TABLE standard ADD CONSTRAINT standard_regulator_id_fkey 
  FOREIGN KEY (regulator_id) REFERENCES regulator(id);

-- ============================================================================
-- PART 4: Convert standard_setter.id from bigint to uuid
-- ============================================================================

-- Create temporary mapping table for standard_setter
CREATE TEMP TABLE standard_setter_id_mapping (
  old_id bigint PRIMARY KEY,
  new_id uuid DEFAULT gen_random_uuid()
);

-- Populate mapping with existing standard_setter IDs
INSERT INTO standard_setter_id_mapping (old_id)
SELECT id FROM standard_setter;

-- Add new uuid column to standard_setter
ALTER TABLE standard_setter ADD COLUMN id_new uuid;

-- Populate new IDs from mapping
UPDATE standard_setter ss
SET id_new = m.new_id
FROM standard_setter_id_mapping m
WHERE ss.id = m.old_id;

-- Update foreign key references in standard table
ALTER TABLE standard ADD COLUMN standard_setter_id_new uuid;

UPDATE standard s
SET standard_setter_id_new = m.new_id
FROM standard_setter_id_mapping m
WHERE s.standard_setter_id = m.old_id;

-- Drop old foreign key constraint
ALTER TABLE standard DROP CONSTRAINT IF EXISTS standard_standard_setter_id_fkey;

-- Drop old columns
ALTER TABLE standard DROP COLUMN standard_setter_id;
ALTER TABLE standard_setter DROP CONSTRAINT standard_setter_pkey;
ALTER TABLE standard_setter DROP COLUMN id;

-- Rename new columns to original names
ALTER TABLE standard_setter RENAME COLUMN id_new TO id;
ALTER TABLE standard RENAME COLUMN standard_setter_id_new TO standard_setter_id;

-- Add primary key and foreign key constraints
ALTER TABLE standard_setter ADD PRIMARY KEY (id);
ALTER TABLE standard ADD CONSTRAINT standard_standard_setter_id_fkey 
  FOREIGN KEY (standard_setter_id) REFERENCES standard_setter(id);

-- ============================================================================
-- PART 5: Update approve_proposed_entity RPC function
-- ============================================================================

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
  v_new_id uuid;
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
  -- All tables now use the same pattern: slug (unique), name (display)
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
      INSERT INTO public.bfsi_organization (
        name,
        slug,
        description,
        entity_type,
        headquarters_country,
        involvement_in_payments
      )
      VALUES (
        v_proposal.name,
        v_proposal.slug,
        v_proposal.metadata->>'description',
        COALESCE(v_proposal.metadata->>'entity_type', 'company'),
        v_proposal.metadata->>'headquarters_country',
        COALESCE((v_proposal.metadata->>'involvement_in_payments')::boolean, false)
      )
      ON CONFLICT (slug) DO NOTHING
      RETURNING id INTO v_new_id;
      
    WHEN 'ag_vendor' THEN
      INSERT INTO public.ag_vendor (
        name,
        slug,
        website,
        hq_country,
        category,
        notes
      )
      VALUES (
        v_proposal.name,
        v_proposal.slug,
        v_proposal.metadata->>'website',
        v_proposal.metadata->>'hq_country',
        COALESCE(v_proposal.metadata->>'category', 'Other'),
        v_proposal.metadata->>'notes'
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

COMMIT;
