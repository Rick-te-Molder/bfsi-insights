#!/usr/bin/env node

import process from 'node:process';
import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';
import { env } from '../config/env.js';
import { getSupabaseAdminClient } from '../clients/supabase.js';

/** @param {string} filePath */
function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

/** @param {string} manifestText */
function parseManifestForRequiredPrompts(manifestText) {
  const lines = manifestText.split(/\r?\n/);
  /** @type {any[]} */
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

/** @param {string} line @param {any} current @param {any[]} required */
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

function validateEnvVars() {
  if (!env.SUPABASE_URL) {
    console.error('CRITICAL: SUPABASE_URL is required');
    process.exit(1);
  }
  if (!env.SUPABASE_SERVICE_KEY) {
    console.error('CRITICAL: SUPABASE_SERVICE_KEY is required');
    process.exit(1);
  }
}

/** @param {any[]} rows */
function groupRowsByAgent(rows) {
  const byAgent = new Map();
  for (const r of rows || []) {
    const list = byAgent.get(r.agent_name) || [];
    list.push(r);
    byAgent.set(r.agent_name, list);
  }
  return byAgent;
}

/** @param {string[]} requiredAgentNames @param {Map<string, any[]>} byAgent */
function findValidationProblems(requiredAgentNames, byAgent) {
  const problems = [];
  for (const agent of requiredAgentNames) {
    const list = byAgent.get(agent) || [];
    if (list.length === 0) {
      problems.push(`Missing current prompt_version row for agent_name="${agent}"`);
    } else if (list.length > 1) {
      problems.push(
        `Multiple current prompts for agent_name="${agent}": ${list.map((/** @type {any} */ x) => x.version).join(', ')}`,
      );
    }
  }
  return problems;
}

function loadManifest() {
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
  return requiredPrompts;
}

/** @param {string[]} requiredAgentNames */
async function fetchPromptVersions(requiredAgentNames) {
  const supabase = getSupabaseAdminClient();
  const { data: rows, error } = await supabase
    .from('prompt_version')
    .select('agent_name, version, stage')
    .in('agent_name', requiredAgentNames)
    .eq('stage', 'PRD');
  if (error) {
    console.error(`CRITICAL: Failed to query prompt_version: ${error.message}`);
    process.exit(1);
  }
  return rows;
}

/** @param {string[]} requiredAgentNames @param {Map<string, any[]>} byAgent */
function printResults(requiredAgentNames, byAgent) {
  console.log('✅ Prompt registry validation passed');
  const sortedAgents = [...requiredAgentNames].sort((a, b) => a.localeCompare(b));
  for (const agent of sortedAgents) {
    const row = (byAgent.get(agent) || [])[0];
    console.log(`- ${agent}: ${row.version}`);
  }
}

async function main() {
  const requiredPrompts = loadManifest();
  validateEnvVars();
  const requiredAgentNames = requiredPrompts.map((p) => p.agent_name);
  const rows = await fetchPromptVersions(requiredAgentNames);
  const byAgent = groupRowsByAgent(rows);
  const problems = findValidationProblems(requiredAgentNames, byAgent);
  if (problems.length) {
    console.error('CRITICAL: Prompt registry validation failed');
    for (const p of problems) console.error(`- ${p}`);
    process.exit(1);
  }
  printResults(requiredAgentNames, byAgent);
}

try {
  await main();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`CRITICAL: ${message}`);
  process.exit(1);
}
