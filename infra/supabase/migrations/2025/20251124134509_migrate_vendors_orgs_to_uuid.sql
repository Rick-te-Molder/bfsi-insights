-- Migration: Convert ag_vendor and bfsi_organization to UUID (CORRECTED)
-- Run date: 2024-11-24
-- Purpose: Complete UUID migration for all publication-related tables

-- ============================================================================
-- PART 1: Migrate ag_vendor to UUID
-- ============================================================================

ALTER TABLE ag_vendor RENAME TO ag_vendor_old;

CREATE TABLE ag_vendor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  aliases text[],
  website text,
  hq_country text,
  regions_served text[],
  founded_year integer,
  ownership_type text,
  headcount_range text,
  funding_stage text,
  parent_entity text,
  deployment text[],
  certifications text[],
  data_coverage jsonb,
  pricing_model text,
  notes text,
  name_lc text,
  name_norm text,
  category text DEFAULT 'Other'
);

-- Add unique constraint on name
CREATE UNIQUE INDEX idx_ag_vendor_name_unique ON ag_vendor(name);

-- Migrate data
INSERT INTO ag_vendor (
  id, created_at, name, updated_at, created_by, aliases, website, hq_country,
  regions_served, founded_year, ownership_type, headcount_range, funding_stage,
  parent_entity, deployment, certifications, data_coverage, pricing_model,
  notes, name_lc, name_norm, category
)
SELECT 
  gen_random_uuid(),
  created_at, name, updated_at, created_by, aliases, website, hq_country,
  regions_served, founded_year, ownership_type, headcount_range, funding_stage,
  parent_entity, deployment, certifications, data_coverage, pricing_model,
  notes, name_lc, name_norm, category
FROM ag_vendor_old;

-- ============================================================================
-- PART 2: Migrate bfsi_organization to UUID
-- ============================================================================

ALTER TABLE bfsi_organization RENAME TO bfsi_organization_old;

CREATE TABLE bfsi_organization (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_name text NOT NULL,
  description text,
  entity_type text,
  headquarters_country text,
  involvement_in_payments boolean
);

-- Add unique constraint on organization_name
CREATE UNIQUE INDEX idx_bfsi_org_name_unique ON bfsi_organization(organization_name);

-- Migrate data
INSERT INTO bfsi_organization (
  id, organization_name, description, entity_type, headquarters_country, involvement_in_payments
)
SELECT 
  gen_random_uuid(),
  organization_name, description, entity_type, headquarters_country, involvement_in_payments
FROM bfsi_organization_old;

-- ============================================================================
-- PART 3: Recreate junction tables
-- ============================================================================

DROP TABLE IF EXISTS kb_publication_ag_vendor CASCADE;
DROP TABLE IF EXISTS kb_publication_bfsi_organization CASCADE;

CREATE TABLE kb_publication_ag_vendor (
  publication_id uuid REFERENCES kb_publication(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES ag_vendor(id) ON DELETE CASCADE,
  rank integer DEFAULT 0,
  PRIMARY KEY (publication_id, vendor_id)
);

CREATE TABLE kb_publication_bfsi_organization (
  publication_id uuid REFERENCES kb_publication(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES bfsi_organization(id) ON DELETE CASCADE,
  rank integer DEFAULT 0,
  PRIMARY KEY (publication_id, organization_id)
);

-- ============================================================================
-- PART 4: Add indexes and RLS
-- ============================================================================

CREATE INDEX idx_kb_publication_ag_vendor_vendor_id ON kb_publication_ag_vendor(vendor_id);
CREATE INDEX idx_kb_publication_bfsi_org_org_id ON kb_publication_bfsi_organization(organization_id);

ALTER TABLE kb_publication_ag_vendor ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_publication_bfsi_organization ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read vendors" ON kb_publication_ag_vendor FOR SELECT TO public USING (true);
CREATE POLICY "Public read orgs" ON kb_publication_bfsi_organization FOR SELECT TO public USING (true);
CREATE POLICY "Service vendors" ON kb_publication_ag_vendor FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service orgs" ON kb_publication_bfsi_organization FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- PART 5: Clean up
-- ============================================================================

DROP TABLE ag_vendor_old CASCADE;
DROP TABLE bfsi_organization_old CASCADE;

-- ============================================================================
-- PART 6: Verify
-- ============================================================================

DO $$
DECLARE
  vendor_count integer;
  org_count integer;
BEGIN
  SELECT COUNT(*) INTO vendor_count FROM ag_vendor;
  SELECT COUNT(*) INTO org_count FROM bfsi_organization;
  
  RAISE NOTICE '✅ Migrated % vendors to UUID', vendor_count;
  RAISE NOTICE '✅ Migrated % organizations to UUID', org_count;
  
  RAISE NOTICE 'ag_vendor.id type: %', 
    (SELECT data_type FROM information_schema.columns 
     WHERE table_name = 'ag_vendor' AND column_name = 'id');
  RAISE NOTICE 'bfsi_organization.id type: %', 
    (SELECT data_type FROM information_schema.columns 
     WHERE table_name = 'bfsi_organization' AND column_name = 'id');
END $$;