#!/usr/bin/env node

/**
 * Validate resources.json against kb.schema.json
 *
 * - Loads canonical JSON schema (schemas/kb.schema.json)
 * - Loads src/data/resources/resources.json
 * - Validates each item with AJV
 * - Prints summary counts
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const ROOT = process.cwd();
const SCHEMA_PATH = path.join(ROOT, 'schemas', 'kb.schema.json');
const DATA_PATH = path.join(ROOT, 'src', 'data', 'resources', 'resources.json');

// ---------------------------------------------------------------------------
// Load schema and data
// ---------------------------------------------------------------------------

async function loadSchema() {
  const raw = await fs.readFile(SCHEMA_PATH, 'utf8');
  return JSON.parse(raw);
}

async function loadResources() {
  const raw = await fs.readFile(DATA_PATH, 'utf8');
  return JSON.parse(raw);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const schema = await loadSchema();
  const resources = await loadResources();

  const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: 'full' });
  addFormats(ajv);

  const validate = ajv.compile(schema);

  let okCount = 0;
  let noThumb = 0;
  let missingDate = 0;

  for (const [idx, item] of (resources || []).entries()) {
    const valid = validate(item);
    if (!valid) {
      const details = ajv.errorsText(validate.errors, { separator: '\n' });
      console.error(`❌ Invalid item at index ${idx} (title="${item.title || ''}")`);
      console.error(details);
      process.exit(1);
    }

    okCount += 1;
    if (!item.thumbnail) noThumb += 1;
    if (!item.date_published && !item.date_added) missingDate += 1;
  }

  console.log(`Resources validated: ${okCount}`);
  console.log(`Items without thumbnail: ${noThumb}`);
  console.log(`Items missing date (published/added): ${missingDate}`);
}

main().catch((err) => {
  console.error('Validation failed with error:', err);
  process.exit(1);
});
