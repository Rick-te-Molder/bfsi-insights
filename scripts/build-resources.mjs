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
    region: 'geography',
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

// value normalization helpers
const ENUM_FIELDS = [
  'role',
  'industry',
  'topic',
  'use_cases',
  'agentic_capabilities',
  'content_type',
  'geography',
];
const ENUMS = Object.fromEntries(
  ENUM_FIELDS.map((f) => [f, new Set(SCHEMA.properties?.[f]?.enum || [])]),
);
function asString(v) {
  if (v == null) return v;
  if (Array.isArray(v)) return v.length ? String(v[0]) : undefined;
  return typeof v === 'string' ? v : String(v);
}
function normalizeEnumField(field, val) {
  const raw = asString(val);
  if (raw == null) return raw;
  const lc = raw.toLowerCase().trim();
  // if lowercased value is allowed, use it; otherwise keep original to fail validation
  return ENUMS[field].has(lc) ? lc : raw;
}
function normalizeAuthors(val) {
  if (Array.isArray(val)) return val.map((x) => String(x).trim()).filter(Boolean);
  if (val == null) return val;
  return [String(val).trim()].filter(Boolean);
}
function sanitizeString(s) {
  if (typeof s !== 'string') return s;
  // Remove control chars except tab (9), newline (10), carriage return (13) without using control-char regex
  let cleaned = '';
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if ((code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127) {
      continue; // skip disallowed control character
    }
    cleaned += s[i];
  }
  // Trim leading/trailing whitespace
  return cleaned.replace(/\s+$/g, '').replace(/^\s+/g, '');
}
function trimStringFields(obj) {
  const out = { ...obj };
  for (const k of Object.keys(out)) {
    if (typeof out[k] === 'string') out[k] = sanitizeString(out[k]);
  }
  return out;
}
function normalizeValues(input) {
  let out = trimStringFields(input);
  // enums as single, canonical strings
  for (const f of ENUM_FIELDS) {
    if (f in out) out[f] = normalizeEnumField(f, out[f]);
  }
  // authors must be array of strings
  if ('authors' in out) out.authors = normalizeAuthors(out.authors);
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

  // normalize values and strip extras before validation
  const normalized = normalizeKeys(obj);
  const withValues = normalizeValues(normalized);
  const canonical = toCanonicalShape(withValues);

  if (!validate(canonical)) {
    const details = ajv.errorsText(validate.errors, { separator: '\n' });
    const extra = Object.keys(withValues).filter((k) => !allowedKeys.has(k));
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
