#!/usr/bin/env node

import process from 'node:process';
import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function parseManifestForRequiredPrompts(manifestText) {
  const lines = manifestText.split(/\r?\n/);
  const required = [];
  let inRequiredPrompts = false;
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip comments and empty lines
    if (line.startsWith('#') || line === '') {
      // no-op, continue to next line
    } else if (line === 'required_prompts:') {
      inRequiredPrompts = true;
      current = null;
    } else if (!inRequiredPrompts) {
      // Not in required_prompts section yet
    } else if (!rawLine.startsWith(' ') && line.endsWith(':')) {
      // Section ends when a new top-level key starts
      break;
    } else {
      current = processRequiredPromptLine(line, current, required);
    }
  }

  if (current) required.push(current);
  return required;
}

function processRequiredPromptLine(line, current, required) {
  if (line.startsWith('- agent_name:')) {
    if (current) required.push(current);
    return {
      agent_name: line.split(':').slice(1).join(':').trim(),
      type: null,
      required: true,
    };
  }

  if (!current) return current;

  if (line.startsWith('type:')) {
    current.type = line.split(':').slice(1).join(':').trim();
  } else if (line.startsWith('required:')) {
    const v = line.split(':').slice(1).join(':').trim();
    current.required = v === 'true';
  }

  return current;
}

async function main() {
  const repoRoot = path.resolve(process.cwd(), '..', '..');
  const manifestPath = path.join(repoRoot, 'docs', 'agents', 'manifest.yaml');

  if (!fs.existsSync(manifestPath)) {
    console.error(`CRITICAL: manifest.yaml not found at: ${manifestPath}`);
    process.exit(1);
  }

  const manifestText = readText(manifestPath);
  const requiredPrompts = parseManifestForRequiredPrompts(manifestText).filter((p) => p.required);

  if (requiredPrompts.length === 0) {
    console.error('CRITICAL: No required prompts found in manifest.yaml');
    process.exit(1);
  }

  const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl) {
    console.error('CRITICAL: PUBLIC_SUPABASE_URL (or SUPABASE_URL) is required');
    process.exit(1);
  }

  if (!supabaseServiceKey) {
    console.error('CRITICAL: SUPABASE_SERVICE_KEY is required');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const requiredAgentNames = requiredPrompts.map((p) => p.agent_name);

  const { data: rows, error } = await supabase
    .from('prompt_version')
    .select('agent_name, version, is_current')
    .in('agent_name', requiredAgentNames)
    .eq('is_current', true);

  if (error) {
    console.error(`CRITICAL: Failed to query prompt_version: ${error.message}`);
    process.exit(1);
  }

  const byAgent = new Map();
  for (const r of rows || []) {
    const list = byAgent.get(r.agent_name) || [];
    list.push(r);
    byAgent.set(r.agent_name, list);
  }

  const problems = [];

  for (const agent of requiredAgentNames) {
    const list = byAgent.get(agent) || [];
    if (list.length === 0) {
      problems.push(`Missing current prompt_version row for agent_name="${agent}"`);
    } else if (list.length > 1) {
      problems.push(
        `Multiple current prompts for agent_name="${agent}": ${list
          .map((x) => x.version)
          .join(', ')}`,
      );
    }
  }

  if (problems.length) {
    console.error('CRITICAL: Prompt registry validation failed');
    for (const p of problems) console.error(`- ${p}`);
    process.exit(1);
  }

  console.log('✅ Prompt registry validation passed');
  const sortedAgents = [...requiredAgentNames].sort((a, b) => a.localeCompare(b));
  for (const agent of sortedAgents) {
    const row = (byAgent.get(agent) || [])[0];
    console.log(`- ${agent}: ${row.version}`);
  }
}

try {
  await main();
} catch (err) {
  console.error(`CRITICAL: ${err?.message || String(err)}`);
  process.exit(1);
}
