#!/usr/bin/env node
/**
 * Dump Supabase database schema to docs/database/schema.md
 *
 * This generates an AI-readable schema reference that includes:
 * - All tables with columns, types, constraints
 * - Foreign key relationships
 * - Indexes
 * - Row counts for context
 *
 * Run: node scripts/utilities/dump-schema.mjs
 * Or:  npm run dump:schema
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env
const envPath = path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('📊 Dumping database schema...\n');

  // Use raw SQL via RPC to get schema info
  const { data: schemaInfo, error } = await supabase.rpc('dump_schema_info');

  if (error) {
    console.log('Creating schema dump function...');
    // Create the function if it doesn't exist
    const createFn = `
      CREATE OR REPLACE FUNCTION dump_schema_info()
      RETURNS TABLE (
        table_name text,
        column_name text,
        data_type text,
        is_nullable text,
        column_default text,
        constraint_type text,
        foreign_table text,
        foreign_column text
      )
      LANGUAGE sql
      SECURITY DEFINER
      AS $$
        SELECT 
          c.table_name::text,
          c.column_name::text,
          c.data_type::text,
          c.is_nullable::text,
          c.column_default::text,
          tc.constraint_type::text,
          ccu.table_name::text as foreign_table,
          ccu.column_name::text as foreign_column
        FROM information_schema.columns c
        LEFT JOIN information_schema.key_column_usage kcu 
          ON c.table_name = kcu.table_name 
          AND c.column_name = kcu.column_name
          AND c.table_schema = kcu.table_schema
        LEFT JOIN information_schema.table_constraints tc
          ON kcu.constraint_name = tc.constraint_name
          AND kcu.table_schema = tc.table_schema
        LEFT JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
          AND tc.constraint_type = 'FOREIGN KEY'
        WHERE c.table_schema = 'public'
        ORDER BY c.table_name, c.ordinal_position;
      $$;
    `;
    console.log('\n⚠️  Please run this SQL in Supabase SQL Editor first:\n');
    console.log(createFn);
    console.log('\nThen re-run this script.');
    process.exit(1);
  }

  // Get row counts
  const counts = {};
  const tableNames = [...new Set(schemaInfo.map((r) => r.table_name))];

  for (const tableName of tableNames) {
    try {
      const { count } = await supabase.from(tableName).select('*', { count: 'exact', head: true });
      counts[tableName] = count ?? '?';
    } catch {
      counts[tableName] = '?';
    }
  }

  // Group by table
  const tables = {};
  for (const row of schemaInfo) {
    if (!tables[row.table_name]) {
      tables[row.table_name] = [];
    }
    tables[row.table_name].push(row);
  }

  // Generate markdown
  let md = `# Database Schema Reference

> **Auto-generated** by \`npm run dump:schema\`  
> **Last updated:** ${new Date().toISOString()}

This file is the single source of truth for AI assistants to understand the database structure.

## Quick Reference

| Table | Rows | Purpose |
|-------|------|---------|
`;

  // Add table summary
  for (const [tableName, cols] of Object.entries(tables).sort()) {
    const pkCol = cols.find((c) => c.constraint_type === 'PRIMARY KEY');
    md += `| \`${tableName}\` | ${counts[tableName]} | ${pkCol ? `PK: ${pkCol.column_name}` : ''} |\n`;
  }

  md += `\n---\n\n## Table Details\n\n`;

  // Add detailed table info
  for (const [tableName, cols] of Object.entries(tables).sort()) {
    md += `### \`${tableName}\`\n\n`;
    md += `**Rows:** ${counts[tableName]}\n\n`;
    md += `| Column | Type | Nullable | Default | Constraints |\n`;
    md += `|--------|------|----------|---------|-------------|\n`;

    for (const col of cols) {
      const constraints = [];
      if (col.constraint_type === 'PRIMARY KEY') constraints.push('PK');
      if (col.constraint_type === 'UNIQUE') constraints.push('UNIQUE');
      if (col.constraint_type === 'FOREIGN KEY') {
        constraints.push(`FK → ${col.foreign_table}.${col.foreign_column}`);
      }

      const defaultVal = col.column_default
        ? col.column_default.substring(0, 30) + (col.column_default.length > 30 ? '...' : '')
        : '';

      md += `| \`${col.column_name}\` | ${col.data_type} | ${col.is_nullable} | ${defaultVal} | ${constraints.join(', ')} |\n`;
    }
    md += '\n';
  }

  // Write to file
  const outDir = path.join(__dirname, '../../docs/data-model');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPath = path.join(outDir, 'schema.md');
  fs.writeFileSync(outPath, md);

  console.log(`✅ Schema written to: docs/data-model/schema.md`);
  console.log(`   ${Object.keys(tables).length} tables, ${schemaInfo.length} columns`);
}

main().catch(console.error);
