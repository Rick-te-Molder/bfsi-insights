-- Standardize all tables to use consistent schema patterns:
-- 
-- ENTITY TABLES (regulator, vendor, org, standard_setter):
--   - id: uuid (PK)
--   - slug: text (UNIQUE, human-friendly identifier)
--   - name: text (display name)
--
-- TAXONOMY/DOMAIN TABLES (process, industry, topic, geography, etc):
--   - id: uuid (PK)
--   - code: text (UNIQUE, structured identifier)
--   - name: text (display name)
--
-- This migration handles:
-- 1. Add slug to bfsi_organization and ag_vendor (entity tables)
-- 2. Convert regulator.id and standard_setter.id from bigint to uuid
-- 3. Add id uuid to kb_category and kb_channel, rename slug to code
-- 4. Rename bfsi_topic to kb_topic (topic is not BFSI-specific)
-- 5. Convert regulation.id from integer to uuid
-- 6. Convert ag_use_case.id from bigint to uuid
-- 7. Update all FK references

BEGIN;

-- ============================================================================
-- PART 0: Drop dependent views (will recreate at end)
-- ============================================================================

DROP VIEW IF EXISTS regulation_pretty CASCADE;
DROP VIEW IF EXISTS regulation_obligations_pretty CASCADE;
DROP VIEW IF EXISTS regulator_pretty CASCADE;

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

-- ============================================================================
-- PART 6: Add id uuid to kb_category, rename slug to code
-- ============================================================================

-- Add id column
ALTER TABLE kb_category ADD COLUMN id uuid DEFAULT gen_random_uuid();

-- Make id NOT NULL and set as primary key
ALTER TABLE kb_category ALTER COLUMN id SET NOT NULL;
ALTER TABLE kb_category DROP CONSTRAINT kb_category_pkey;
ALTER TABLE kb_category ADD PRIMARY KEY (id);

-- Rename slug to code and make it UNIQUE instead of PK
ALTER TABLE kb_category RENAME COLUMN slug TO code;
ALTER TABLE kb_category ADD CONSTRAINT kb_category_code_unique UNIQUE (code);

-- ============================================================================
-- PART 7: Add id uuid to kb_channel, rename slug to code
-- ============================================================================

-- Drop FK constraint from kb_source first
ALTER TABLE kb_source DROP CONSTRAINT IF EXISTS kb_source_channel_slug_fkey;

-- Add id column
ALTER TABLE kb_channel ADD COLUMN id uuid DEFAULT gen_random_uuid();

-- Make id NOT NULL and set as primary key
ALTER TABLE kb_channel ALTER COLUMN id SET NOT NULL;
ALTER TABLE kb_channel DROP CONSTRAINT kb_channel_pkey;
ALTER TABLE kb_channel ADD PRIMARY KEY (id);

-- Rename slug to code and make it UNIQUE instead of PK
ALTER TABLE kb_channel RENAME COLUMN slug TO code;
ALTER TABLE kb_channel ADD CONSTRAINT kb_channel_code_unique UNIQUE (code);

-- Update FK in kb_source table (channel_slug -> channel_code)
ALTER TABLE kb_source RENAME COLUMN channel_slug TO channel_code;
ALTER TABLE kb_source ADD CONSTRAINT kb_source_channel_code_fkey 
  FOREIGN KEY (channel_code) REFERENCES kb_channel(code);

-- ============================================================================
-- PART 8: Rename bfsi_topic to kb_topic
-- ============================================================================

ALTER TABLE bfsi_topic RENAME TO kb_topic;

-- Update junction table name
ALTER TABLE kb_publication_bfsi_topic RENAME TO kb_publication_kb_topic;

-- Update FK constraint names for clarity
ALTER TABLE kb_publication_kb_topic DROP CONSTRAINT IF EXISTS kb_publication_bfsi_topic_publication_id_fkey;
ALTER TABLE kb_publication_kb_topic ADD CONSTRAINT kb_publication_kb_topic_publication_id_fkey 
  FOREIGN KEY (publication_id) REFERENCES kb_publication(id) ON DELETE CASCADE;

-- Rename topic_code column references in other tables if needed
-- (Most tables already use topic_code which is fine)

-- ============================================================================
-- PART 9: Convert regulation.id from integer to uuid
-- ============================================================================

-- Note: regulation has no FK references to it, so this is simpler

-- Add new uuid column
ALTER TABLE regulation ADD COLUMN id_new uuid DEFAULT gen_random_uuid();

-- Make it NOT NULL
ALTER TABLE regulation ALTER COLUMN id_new SET NOT NULL;

-- Drop old PK and column
ALTER TABLE regulation DROP CONSTRAINT regulation_pkey;
ALTER TABLE regulation DROP COLUMN id;

-- Rename new column
ALTER TABLE regulation RENAME COLUMN id_new TO id;

-- Add new PK
ALTER TABLE regulation ADD PRIMARY KEY (id);

-- ============================================================================
-- PART 10: Convert ag_use_case.id from bigint to uuid
-- ============================================================================

-- Create temporary mapping table
CREATE TEMP TABLE ag_use_case_id_mapping (
  old_id bigint PRIMARY KEY,
  new_id uuid DEFAULT gen_random_uuid()
);

-- Populate mapping
INSERT INTO ag_use_case_id_mapping (old_id)
SELECT id FROM ag_use_case;

-- Add new uuid column to ag_use_case
ALTER TABLE ag_use_case ADD COLUMN id_new uuid;

-- Populate new IDs from mapping
UPDATE ag_use_case uc
SET id_new = m.new_id
FROM ag_use_case_id_mapping m
WHERE uc.id = m.old_id;

-- Update FK in ag_use_case_capability
ALTER TABLE ag_use_case_capability ADD COLUMN use_case_id_new uuid;

UPDATE ag_use_case_capability ucc
SET use_case_id_new = m.new_id
FROM ag_use_case_id_mapping m
WHERE ucc.use_case_id = m.old_id;

-- Drop old FK constraint
ALTER TABLE ag_use_case_capability DROP CONSTRAINT IF EXISTS ag_use_case_capability_use_case_id_fkey;

-- Drop old columns
ALTER TABLE ag_use_case_capability DROP COLUMN use_case_id;
ALTER TABLE ag_use_case DROP CONSTRAINT ag_use_case_pkey;
ALTER TABLE ag_use_case DROP COLUMN id;

-- Rename new columns
ALTER TABLE ag_use_case RENAME COLUMN id_new TO id;
ALTER TABLE ag_use_case_capability RENAME COLUMN use_case_id_new TO use_case_id;

-- Add new PK and FK
ALTER TABLE ag_use_case ADD PRIMARY KEY (id);
ALTER TABLE ag_use_case_capability ADD CONSTRAINT ag_use_case_capability_use_case_id_fkey 
  FOREIGN KEY (use_case_id) REFERENCES ag_use_case(id);

-- ============================================================================
-- PART 11: Recreate views with updated schema
-- ============================================================================

CREATE OR REPLACE VIEW regulation_obligations_pretty AS
SELECT 
  r.id,
  r.code,
  r.title,
  (jsonb_array_elements(r.obligations) ->> 'text') AS obligation,
  r.domain,
  rg.name AS regulator_name
FROM regulation r
LEFT JOIN regulator rg ON rg.id = r.regulator_id;

CREATE OR REPLACE VIEW regulation_pretty AS
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

CREATE OR REPLACE VIEW regulator_pretty AS
SELECT 
  id,
  name,
  slug,
  jurisdiction,
  website_url
FROM regulator;

COMMIT;
