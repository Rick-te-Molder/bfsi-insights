#!/usr/bin/env node
/**
 * View Supabase Schema - Lists all tables, columns, and relationships
 * Usage: node scripts/utilities/view-schema.mjs
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

async function getSchema() {
  console.log('📊 Fetching Supabase Schema...\n');

  // Get all tables
  const { data: tables, error: tablesError } = await supabase.rpc('get_tables_info');

  if (tablesError) {
    // Fallback: query information_schema directly
    console.log('Using information_schema fallback...\n');
    await getSchemaFromInfoSchema();
    return;
  }

  console.log(JSON.stringify(tables, null, 2));
}

async function getSchemaFromInfoSchema() {
  // Query for all public tables
  const { data: tables } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .eq('table_type', 'BASE TABLE');

  if (!tables) {
    console.log('❌ Could not fetch tables. Running SQL query instead...');
    await runDirectQuery();
    return;
  }

  for (const table of tables) {
    console.log(`\n📋 ${table.table_name}`);
  }
}

async function runDirectQuery() {
  // This query gets all tables and their columns
  const query = `
    SELECT 
      t.table_name,
      c.column_name,
      c.data_type,
      c.is_nullable,
      c.column_default
    FROM information_schema.tables t
    JOIN information_schema.columns c 
      ON t.table_name = c.table_name 
      AND t.table_schema = c.table_schema
    WHERE t.table_schema = 'public' 
      AND t.table_type = 'BASE TABLE'
    ORDER BY t.table_name, c.ordinal_position;
  `;

  console.log('Run this SQL in Supabase SQL Editor:\n');
  console.log(query);
}

// Also check what taxonomy tables exist
async function checkTaxonomyTables() {
  console.log('\n' + '='.repeat(60));
  console.log('🏷️  TAXONOMY TABLES ANALYSIS');
  console.log('='.repeat(60));

  const taxonomyTables = [
    // Known taxonomy tables
    'bfsi_industry',
    'bfsi_topic',
    'bfsi_geography',
    'bfsi_organization',
    'ag_vendor',
    'ag_use_case',
    'ag_capability',
    'regulation',
    'regulator',
    'obligation',
    // Junction tables
    'kb_publication_bfsi_industry',
    'kb_publication_bfsi_topic',
    'kb_publication_bfsi_geography',
    'kb_publication_bfsi_organization',
    'kb_publication_ag_vendor',
  ];

  console.log('\nChecking taxonomy tables...\n');

  for (const table of taxonomyTables) {
    try {
      const { error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`❌ ${table}: Does not exist`);
      } else {
        console.log(`✅ ${table}: Exists (${count} rows)`);
      }
    } catch (e) {
      console.log(`❌ ${table}: Error - ${e.message}`);
    }
  }

  // Check which tables are used in tagging
  console.log('\n' + '-'.repeat(60));
  console.log('📊 TAGGING USAGE IN CODE');
  console.log('-'.repeat(60));

  console.log(`
Current tag.js uses:
- bfsi_industry (code, name) ✅
- bfsi_topic (code, name) ✅

NOT used in tagging:
- bfsi_geography (exists but not auto-tagged)
- bfsi_organization (exists but not auto-tagged)
- ag_vendor (exists but not auto-tagged)
- ag_use_case (unknown)
- ag_capability (unknown)
- regulation (unknown)
- regulator (unknown)
- obligation (unknown)
  `);
}

// Run
getSchema()
  .then(() => checkTaxonomyTables())
  .catch(console.error);
