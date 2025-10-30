#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const SCHEMA_PATH = 'schemas/kb.schema.json';
const ITEMS_DIR = 'src/data/resources/items';
const OUT_FILE = 'src/data/resources/resources.json';

// load canonical schema
const schemaRaw = await fs.readFile(SCHEMA_PATH, 'utf8');
const SCHEMA = JSON.parse(schemaRaw);

// Use full format validation and rely on ajv-formats defaults (uri, date, date-time)
const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: 'full' });
addFormats(ajv);

const validate = ajv.compile(SCHEMA);

// map legacy keys -> canonical schema keys
function normalizeKeys(input) {
  const legacyMap = {
    usecases: 'use_cases',
    usecase: 'use_cases',
    agentic_capability: 'agentic_capabilities',
    type: 'content_type',
    region: 'jurisdiction',
  };
  const out = { ...input };
  for (const [legacy, canonical] of Object.entries(legacyMap)) {
    if (out[legacy] != null && out[canonical] == null) out[canonical] = out[legacy];
    delete out[legacy];
  }
  return out;
}

// keep only schema-allowed keys (after normalization)
const allowedKeys = new Set(Object.keys(SCHEMA.properties || {}));
function toCanonicalShape(input) {
  const out = {};
  for (const k of Object.keys(input)) {
    if (allowedKeys.has(k)) out[k] = input[k];
  }
  return out;
}

const files = (await fs.readdir(ITEMS_DIR)).filter((f) => f.endsWith('.json')).sort();
const items = [];

for (const f of files) {
  const p = path.join(ITEMS_DIR, f);
  const raw = await fs.readFile(p, 'utf8');
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch (e) {
    console.error(`Invalid JSON: ${f}\n${e.message}`);
    process.exit(1);
  }

  // normalize and strip extras before validation
  const normalized = normalizeKeys(obj);
  const canonical = toCanonicalShape(normalized);

  if (!validate(canonical)) {
    const details = ajv.errorsText(validate.errors, { separator: '\n' });
    const extra = Object.keys(normalized).filter((k) => !allowedKeys.has(k));
    console.error(
      `Invalid: ${f}\n${details}${extra.length ? `\nExtra keys: ${extra.join(', ')}` : ''}`,
    );
    process.exit(1);
  }

  items.push(canonical);
}

await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
await fs.writeFile(OUT_FILE, JSON.stringify(items, null, 2));
console.log(`Wrote ${OUT_FILE} (${items.length} items)`);
