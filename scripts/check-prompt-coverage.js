#!/usr/bin/env node
/**
 * Check Prompt Coverage
 * KB-207: Validates that all required prompts from manifest exist in prompt_version
 *
 * Usage:
 *   node scripts/check-prompt-coverage.js
 *   node scripts/check-prompt-coverage.js --ci  # Exit with error code on failure
 *
 * Requires:
 *   - SUPABASE_URL or PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_KEY
 */

import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parse } from 'yaml';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  dim: '\x1b[2m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function main() {
  const isCI = process.argv.includes('--ci');

  log('\n📋 Checking Prompt Coverage (KB-207)\n', 'blue');

  // 1. Load manifest
  const manifestPath = join(__dirname, '..', 'docs', 'agents', 'manifest.yaml');
  let manifest;
  try {
    const manifestContent = readFileSync(manifestPath, 'utf-8');
    manifest = parse(manifestContent);
    log(`✓ Loaded manifest: ${manifest.agents.length} agents defined`, 'green');
  } catch (err) {
    log(`✗ Failed to load manifest: ${err.message}`, 'red');
    process.exit(1);
  }

  // 2. Connect to Supabase
  const supabaseUrl = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    log('✗ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY', 'red');
    log('  Set environment variables or run with local seed files', 'dim');
    if (isCI) process.exit(1);
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // 3. Fetch current prompts from DB (try new table name, fall back to old)
  let prompts;
  let promptError;

  // Try prompt_version (new canonical name) first
  const result1 = await supabase
    .from('prompt_version')
    .select('agent_name, version, is_current')
    .eq('is_current', true);

  if (!result1.error) {
    prompts = result1.data;
  } else {
    // Fall back to prompt_versions (old name) for backwards compatibility
    const result2 = await supabase
      .from('prompt_versions')
      .select('agent_name, version, is_current')
      .eq('is_current', true);
    prompts = result2.data;
    promptError = result2.error;
  }

  if (promptError) {
    log(`✗ Failed to fetch prompts: ${promptError.message}`, 'red');
    if (isCI) process.exit(1);
    return;
  }

  const currentPrompts = new Map(prompts.map((p) => [p.agent_name, p]));
  log(`✓ Found ${currentPrompts.size} current prompts in DB`, 'green');

  // 4. Check required prompts
  log('\n--- Required Prompts ---', 'blue');

  const requiredPrompts = manifest.required_prompts || [];
  let missingRequired = 0;
  let missingOptional = 0;

  for (const req of requiredPrompts) {
    const exists = currentPrompts.has(req.agent_name);
    const icon = exists ? '✓' : req.required ? '✗' : '○';
    const color = exists ? 'green' : req.required ? 'red' : 'yellow';
    const status = exists
      ? `v${currentPrompts.get(req.agent_name).version}`
      : req.required
        ? 'MISSING'
        : 'optional';

    log(`  ${icon} ${req.agent_name} (${req.type}): ${status}`, color);

    if (!exists) {
      if (req.required) missingRequired++;
      else missingOptional++;
    }
  }

  // 5. Check required tables
  log('\n--- Required Tables ---', 'blue');

  const requiredTables = manifest.required_tables || [];
  let missingTables = 0;

  for (const table of requiredTables) {
    const { count, error } = await supabase
      .from(table.table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      log(`  ✗ ${table.table}: ERROR - ${error.message}`, 'red');
      missingTables++;
      continue;
    }

    const hasMinRows = count >= (table.min_rows || 1);
    const icon = hasMinRows ? '✓' : '✗';
    const color = hasMinRows ? 'green' : 'red';

    log(`  ${icon} ${table.table}: ${count} rows (min: ${table.min_rows || 1})`, color);

    if (!hasMinRows) missingTables++;
  }

  // 6. List agents and their prompt status
  log('\n--- Agent Status ---', 'blue');

  for (const agent of manifest.agents) {
    const promptsNeeded = agent.prompt_versions || [];

    if (promptsNeeded.length === 0) {
      log(`  ○ ${agent.name} (${agent.type}): no prompts required`, 'dim');
      continue;
    }

    const allPresent = promptsNeeded.every((p) => currentPrompts.has(p));
    const icon = allPresent ? '✓' : '✗';
    const color = allPresent ? 'green' : 'red';
    const missing = promptsNeeded.filter((p) => !currentPrompts.has(p));

    if (allPresent) {
      log(`  ${icon} ${agent.name}: all prompts present`, color);
    } else {
      log(`  ${icon} ${agent.name}: missing [${missing.join(', ')}]`, color);
      if (agent.type === 'llm') missingRequired++;
    }
  }

  // 7. Summary
  log('\n--- Summary ---', 'blue');

  const totalIssues = missingRequired + missingTables;

  if (totalIssues === 0) {
    log('✓ All required prompts and tables present!', 'green');
    log(`  ${missingOptional} optional items missing (OK)`, 'dim');
  } else {
    log(`✗ ${totalIssues} required items missing:`, 'red');
    if (missingRequired > 0) log(`  - ${missingRequired} prompts`, 'red');
    if (missingTables > 0) log(`  - ${missingTables} tables with insufficient data`, 'red');
  }

  console.log('');

  if (isCI && totalIssues > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  log(`\n✗ Unexpected error: ${err.message}`, 'red');
  process.exit(1);
});
