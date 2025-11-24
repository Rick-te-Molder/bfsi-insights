-- Migration: Convert ag_vendor and bfsi_organization to UUID
-- Run date: 2024-11-24
-- Purpose: Complete UUID migration for all publication-related tables

-- ============================================================================
-- PART 1: Migrate ag_vendor to UUID
-- ============================================================================

-- Store old ID to new UUID mapping
CREATE TEMP TABLE ag_vendor_id_map (
  old_id integer,
  new_id uuid
);

-- Rename old table
ALTER TABLE ag_vendor RENAME TO ag_vendor_old;

-- Create new table with UUID
CREATE TABLE ag_vendor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  name_norm text,
  description text,
  url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Migrate data and store mapping
INSERT INTO ag_vendor (id, name, slug, name_norm, description, url, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  name, 
  slug, 
  name_norm, 
  description, 
  url, 
  created_at, 
  updated_at
FROM ag_vendor_old
RETURNING id, (SELECT old.id FROM ag_vendor_old old WHERE old.slug = ag_vendor.slug LIMIT 1) as old_id;

-- Store mapping for junction table migration
INSERT INTO ag_vendor_id_map (old_id, new_id)
SELECT 
  old.id,
  new.id
FROM ag_vendor_old old
JOIN ag_vendor new ON new.slug = old.slug;

-- ============================================================================
-- PART 2: Migrate bfsi_organization to UUID
-- ============================================================================

-- Store old ID to new UUID mapping
CREATE TEMP TABLE bfsi_org_id_map (
  old_id integer,
  new_id uuid
);

-- Rename old table
ALTER TABLE bfsi_organization RENAME TO bfsi_organization_old;

-- Create new table with UUID
CREATE TABLE bfsi_organization (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  name_norm text,
  description text,
  url text,
  entity_type_code text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Migrate data
INSERT INTO bfsi_organization (id, name, slug, name_norm, description, url, entity_type_code, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  name, 
  slug, 
  name_norm, 
  description, 
  url, 
  entity_type_code,
  created_at, 
  updated_at
FROM bfsi_organization_old;

-- Store mapping
INSERT INTO bfsi_org_id_map (old_id, new_id)
SELECT 
  old.id,
  new.id
FROM bfsi_organization_old old
JOIN bfsi_organization new ON new.slug = old.slug;

-- ============================================================================
-- PART 3: Recreate junction tables with UUID foreign keys
-- ============================================================================

-- Backup junction table data
CREATE TEMP TABLE kb_pub_vendor_backup AS
SELECT * FROM kb_publication_ag_vendor;

CREATE TEMP TABLE kb_pub_org_backup AS
SELECT * FROM kb_publication_bfsi_organization;

-- Drop old junction tables
DROP TABLE kb_publication_ag_vendor CASCADE;
DROP TABLE kb_publication_bfsi_organization CASCADE;

-- Create new junction tables with UUID foreign keys
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

-- Migrate junction table data using ID mapping
INSERT INTO kb_publication_ag_vendor (publication_id, vendor_id, rank)
SELECT 
  backup.publication_id,
  map.new_id,
  backup.rank
FROM kb_pub_vendor_backup backup
JOIN ag_vendor_id_map map ON map.old_id = backup.vendor_id;

INSERT INTO kb_publication_bfsi_organization (publication_id, organization_id, rank)
SELECT 
  backup.publication_id,
  map.new_id,
  backup.rank
FROM kb_pub_org_backup backup
JOIN bfsi_org_id_map map ON map.old_id = backup.organization_id;

-- ============================================================================
-- PART 4: Add indexes
-- ============================================================================

CREATE INDEX idx_kb_publication_ag_vendor_vendor_id ON kb_publication_ag_vendor(vendor_id);
CREATE INDEX idx_kb_publication_bfsi_org_org_id ON kb_publication_bfsi_organization(organization_id);

-- ============================================================================
-- PART 5: Enable RLS (already done in previous migration, but ensure)
-- ============================================================================

ALTER TABLE kb_publication_ag_vendor ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_publication_bfsi_organization ENABLE ROW LEVEL SECURITY;

-- Policies already created in previous migration

-- ============================================================================
-- PART 6: Clean up
-- ============================================================================

DROP TABLE ag_vendor_old CASCADE;
DROP TABLE bfsi_organization_old CASCADE;

-- ============================================================================
-- PART 7: Verify
-- ============================================================================

DO $$
DECLARE
  vendor_count integer;
  org_count integer;
  junction_vendor_count integer;
  junction_org_count integer;
BEGIN
  SELECT COUNT(*) INTO vendor_count FROM ag_vendor;
  SELECT COUNT(*) INTO org_count FROM bfsi_organization;
  SELECT COUNT(*) INTO junction_vendor_count FROM kb_publication_ag_vendor;
  SELECT COUNT(*) INTO junction_org_count FROM kb_publication_bfsi_organization;
  
  RAISE NOTICE '✅ Migrated % vendors to UUID', vendor_count;
  RAISE NOTICE '✅ Migrated % organizations to UUID', org_count;
  RAISE NOTICE '✅ Migrated % publication-vendor links', junction_vendor_count;
  RAISE NOTICE '✅ Migrated % publication-organization links', junction_org_count;
  
  RAISE NOTICE 'ag_vendor.id type: %', 
    (SELECT data_type FROM information_schema.columns 
     WHERE table_name = 'ag_vendor' AND column_name = 'id');
  RAISE NOTICE 'bfsi_organization.id type: %', 
    (SELECT data_type FROM information_schema.columns 
     WHERE table_name = 'bfsi_organization' AND column_name = 'id');
END $$;
