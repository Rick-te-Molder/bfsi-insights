#!/usr/bin/env node

/**
 * Build resources.json from kb_publication_pretty
 *
 * - Loads canonical JSON schema (schemas/kb.schema.json)
 * - Optionally enriches schema.role.enum with values from kb_role
 * - Fetches published items from kb_publication_pretty
 * - Normalises / cleans values
 * - Validates against schema
 * - Writes src/data/resources/resources.json
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

if (process.env.NODE_ENV !== 'production') {
  // In CI/CD, env vars come from the platform
  dotenv.config({ silent: true });
}

const SCHEMA_PATH = 'schemas/kb.schema.json';
const OUT_FILE = 'src/data/resources/resources.json';

// Load canonical schema
const schemaRaw = await fs.readFile(SCHEMA_PATH, 'utf8');
const SCHEMA = JSON.parse(schemaRaw);

// Initialise Supabase client
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials (PUBLIC_SUPABASE_URL / SERVICE_KEY / ANON_KEY).');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ---------------------------------------------------------------------------
// Dynamic role loading (kb_role → schema.properties.role.enum)
// ---------------------------------------------------------------------------

async function loadRolesIntoSchema() {
  try {
    const { data: rolesData, error } = await supabase
      .from('kb_role')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.warn('Could not fetch roles from kb_role, using schema defaults:', error.message);
      return;
    }
    if (!rolesData || rolesData.length === 0) return;

    const sample = rolesData[0];
    const key = ['code', 'value', 'slug', 'name', 'id'].find((k) => k in sample);

    if (!key) {
      console.warn(
        'kb_role has no usable column among code/value/slug/name/id, using schema defaults.',
      );
      return;
    }

    const values = rolesData
      .map((r) => (r[key] == null ? null : String(r[key]).trim()))
      .filter(Boolean);

    if (!values.length) return;

    SCHEMA.properties.role.enum = values;
    console.log('✓ Loaded roles from database:', SCHEMA.properties.role.enum.join(', '));
  } catch (e) {
    console.warn('Error loading roles from kb_role, using schema defaults:', e.message);
  }
}

await loadRolesIntoSchema();

// ---------------------------------------------------------------------------
// AJV validator
// ---------------------------------------------------------------------------

const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: 'full' });
addFormats(ajv);
const validate = ajv.compile(SCHEMA);

// ---------------------------------------------------------------------------
// Normalisation helpers
// ---------------------------------------------------------------------------

// Legacy key mapping → canonical keys
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

// Keep only schema-allowed keys (after normalisation)
const allowedKeys = new Set(Object.keys(SCHEMA.properties || {}));
function toCanonicalShape(input) {
  const out = {};
  for (const k of Object.keys(input)) {
    if (allowedKeys.has(k)) out[k] = input[k];
  }
  return out;
}

// Enum fields we normalise
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
  // If lowercased value is allowed, use it; otherwise keep original to fail validation
  return ENUMS[field].has(lc) ? lc : raw;
}

/**
 * Authors must always be an array of strings.
 * Accepts:
 * - null/undefined   → []
 * - string           → splits on comma, or single-element array
 * - array            → normalised to trimmed strings
 */
function normalizeAuthors(val) {
  if (val == null) return [];
  if (Array.isArray(val)) {
    return val.map((x) => String(x).trim()).filter(Boolean);
  }
  const s = String(val).trim();
  if (!s) return [];
  const parts = s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  return parts.length ? parts : [s];
}

/**
 * Remove control characters from a string except tab, newline, carriage return.
 */
function sanitizeString(s) {
  if (typeof s !== 'string') return s;
  let cleaned = '';
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if ((code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127) continue;
    cleaned += s[i];
  }
  return cleaned.replace(/\s+$/g, '').replace(/^\s+/g, '');
}

function trimStringFields(obj) {
  const out = { ...obj };
  for (const k of Object.keys(out)) {
    if (typeof out[k] === 'string') out[k] = sanitizeString(out[k]);
  }
  return out;
}

/**
 * Apply enums, authors-array, and trimming.
 */
function normalizeValues(input) {
  let out = trimStringFields(input);

  for (const f of ENUM_FIELDS) {
    if (f in out) out[f] = normalizeEnumField(f, out[f]);
  }

  out.authors = normalizeAuthors(out.authors);

  return out;
}

/**
 * Ensure summary fields roughly respect target length ranges.
 */
function fixSummaryLengths(obj) {
  const ranges = {
    summary_short: { min: 120, max: 240 },
    summary_medium: { min: 240, max: 480 },
    summary_long: { min: 640, max: 1120 },
  };

  const out = { ...obj };

  function normalizeField(key, fallbackKeys = []) {
    const r = ranges[key];
    if (!r) return;

    let text = out[key];
    if (!text) {
      for (const fk of fallbackKeys) {
        if (out[fk]) {
          text = out[fk];
          break;
        }
      }
    }
    if (!text) return;

    text = String(text).trim();

    if (text.length > r.max) {
      text = text.slice(0, r.max).trim();
    }

    if (text.length < r.min) {
      for (const fk of fallbackKeys) {
        if (out[fk]) {
          const extra = String(out[fk]).slice(0, r.min - text.length);
          text = (text + ' ' + extra).trim();
          if (text.length >= r.min) break;
        }
      }
      while (text.length < r.min) {
        text = (text + ' …').trim();
      }
    }

    out[key] = text;
  }

  normalizeField('summary_short', ['summary_medium', 'summary_long']);
  normalizeField('summary_medium', ['summary_long', 'summary_short']);
  normalizeField('summary_long', ['summary_medium', 'summary_short']);

  return out;
}

// ---------------------------------------------------------------------------
// Fetch from kb_publication_pretty and build resources.json
// ---------------------------------------------------------------------------

const { data: dbResources, error } = await supabase
  .from('kb_publication_pretty')
  .select('*')
  .order('date_added', { ascending: false });

if (error) {
  console.error('Error fetching resources from Supabase:', error);
  process.exit(1);
}

if (!dbResources || dbResources.length === 0) {
  console.warn('⚠️  No resources found in database. Check:');
  console.warn('   - PUBLIC_SUPABASE_URL and keys are set');
  console.warn('   - kb_publication has rows with status="published"');
  console.warn('   - Anon/service key has SELECT on kb_publication_pretty');
}

const items = [];

for (const resource of dbResources || []) {
  // Pick best URL we have (backward-compatible fallbacks)
  const url =
    resource.canonical_url ||
    resource.source_url ||
    resource.url ||
    resource.canonicalUrl ||
    resource.sourceUrl;

  // Prefer authors/author field if present
  const rawAuthors = resource.authors ?? resource.author ?? null;

  // Map database columns to schema format
  const obj = {
    url,
    title: resource.title,
    slug: resource.slug,
    source_name: resource.source_name || resource.source || null,
    date_published: resource.date_published || resource.publication_date || null,
    date_added: resource.date_added,
    authors: rawAuthors,
    summary_short: resource.summary_short,
    summary_medium: resource.summary_medium,
    summary_long: resource.summary_long,
    role: resource.role,
    content_type: resource.content_type,
    industry: resource.industry,
    topic: resource.topic,
    geography: resource.geography,
    use_cases: resource.use_cases,
    agentic_capabilities: resource.agentic_capabilities,
  };

  if (resource.thumbnail) {
    obj.thumbnail = resource.thumbnail;
  }

  // Normalise → fix summaries → strip extras → validate
  const normalized = normalizeKeys(obj);
  const withValues = normalizeValues(normalized);
  const withSummariesFixed = fixSummaryLengths(withValues);
  const canonical = toCanonicalShape(withSummariesFixed);

  if (!validate(canonical)) {
    const details = ajv.errorsText(validate.errors, { separator: '\n' });
    const extra = Object.keys(withValues).filter((k) => !allowedKeys.has(k));
    console.error(
      `Invalid: ${resource.title}\n${details}${
        extra.length ? `\nExtra keys: ${extra.join(', ')}` : ''
      }`,
    );
    process.exit(1);
  }

  items.push(canonical);
}

// ---------------------------------------------------------------------------
// Write resources.json
// ---------------------------------------------------------------------------

await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
await fs.writeFile(OUT_FILE, JSON.stringify(items, null, 2));
console.log(`Wrote ${OUT_FILE} (${items.length} items)`);
