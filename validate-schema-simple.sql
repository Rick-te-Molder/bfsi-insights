-- Single query validation - returns all checks in one result set

SELECT * FROM (
  -- Entity tables have slug
  SELECT 1 as sort_order, 'bfsi_organization has slug' as check_name, 
    EXISTS(SELECT 1 FROM information_schema.columns 
           WHERE table_name = 'bfsi_organization' AND column_name = 'slug') as passed,
    NULL::bigint as count
  UNION ALL
  SELECT 2, 'ag_vendor has slug',
    EXISTS(SELECT 1 FROM information_schema.columns 
           WHERE table_name = 'ag_vendor' AND column_name = 'slug'),
    NULL
  
  -- UUID primary keys
  UNION ALL
  SELECT 3, 'regulator.id is uuid',
    (SELECT data_type FROM information_schema.columns 
     WHERE table_name = 'regulator' AND column_name = 'id') = 'uuid',
    NULL
  UNION ALL
  SELECT 4, 'standard_setter.id is uuid',
    (SELECT data_type FROM information_schema.columns 
     WHERE table_name = 'standard_setter' AND column_name = 'id') = 'uuid',
    NULL
  UNION ALL
  SELECT 5, 'regulation.id is uuid',
    (SELECT data_type FROM information_schema.columns 
     WHERE table_name = 'regulation' AND column_name = 'id') = 'uuid',
    NULL
  UNION ALL
  SELECT 6, 'ag_use_case.id is uuid',
    (SELECT data_type FROM information_schema.columns 
     WHERE table_name = 'ag_use_case' AND column_name = 'id') = 'uuid',
    NULL
  
  -- kb_category and kb_channel
  UNION ALL
  SELECT 7, 'kb_category has id uuid',
    (SELECT data_type FROM information_schema.columns 
     WHERE table_name = 'kb_category' AND column_name = 'id') = 'uuid',
    NULL
  UNION ALL
  SELECT 8, 'kb_category has code',
    EXISTS(SELECT 1 FROM information_schema.columns 
           WHERE table_name = 'kb_category' AND column_name = 'code'),
    NULL
  UNION ALL
  SELECT 9, 'kb_channel has id uuid',
    (SELECT data_type FROM information_schema.columns 
     WHERE table_name = 'kb_channel' AND column_name = 'id') = 'uuid',
    NULL
  UNION ALL
  SELECT 10, 'kb_channel has code',
    EXISTS(SELECT 1 FROM information_schema.columns 
           WHERE table_name = 'kb_channel' AND column_name = 'code'),
    NULL
  
  -- Table renames
  UNION ALL
  SELECT 11, 'kb_topic exists',
    EXISTS(SELECT 1 FROM information_schema.tables 
           WHERE table_name = 'kb_topic'),
    NULL
  UNION ALL
  SELECT 12, 'bfsi_topic does not exist',
    NOT EXISTS(SELECT 1 FROM information_schema.tables 
               WHERE table_name = 'bfsi_topic'),
    NULL
  UNION ALL
  SELECT 13, 'kb_publication_kb_topic exists',
    EXISTS(SELECT 1 FROM information_schema.tables 
           WHERE table_name = 'kb_publication_kb_topic'),
    NULL
  
  -- Column renames
  UNION ALL
  SELECT 14, 'bfsi_organization.name exists',
    EXISTS(SELECT 1 FROM information_schema.columns 
           WHERE table_name = 'bfsi_organization' AND column_name = 'name'),
    NULL
  UNION ALL
  SELECT 15, 'bfsi_organization.organization_name does not exist',
    NOT EXISTS(SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'bfsi_organization' AND column_name = 'organization_name'),
    NULL
  UNION ALL
  SELECT 16, 'kb_source.channel_code exists',
    EXISTS(SELECT 1 FROM information_schema.columns 
           WHERE table_name = 'kb_source' AND column_name = 'channel_code'),
    NULL
  
  -- Row counts
  UNION ALL
  SELECT 17, 'regulator row count', NULL, (SELECT COUNT(*) FROM regulator)
  UNION ALL
  SELECT 18, 'standard_setter row count', NULL, (SELECT COUNT(*) FROM standard_setter)
  UNION ALL
  SELECT 19, 'bfsi_organization row count', NULL, (SELECT COUNT(*) FROM bfsi_organization)
  UNION ALL
  SELECT 20, 'ag_vendor row count', NULL, (SELECT COUNT(*) FROM ag_vendor)
  UNION ALL
  SELECT 21, 'kb_topic row count', NULL, (SELECT COUNT(*) FROM kb_topic)
  UNION ALL
  SELECT 22, 'regulation row count', NULL, (SELECT COUNT(*) FROM regulation)
  UNION ALL
  SELECT 23, 'ag_use_case row count', NULL, (SELECT COUNT(*) FROM ag_use_case)
) checks
ORDER BY sort_order;

-- Expected results:
-- Rows 1-16: passed = TRUE
-- Row 17: count = 22 (regulator)
-- Row 18: count = 10 (standard_setter)
-- Row 19: count = 8 (bfsi_organization)
-- Row 20: count = 81 (ag_vendor)
-- Row 21: count = 5 (kb_topic)
-- Row 22: count = 18 (regulation)
-- Row 23: count = 16 (ag_use_case)
