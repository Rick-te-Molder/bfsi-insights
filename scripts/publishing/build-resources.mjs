#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load .env for local development only
// In CI/CD, environment variables should be set directly in the platform
// DO NOT commit .env file to version control (already in .gitignore)
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ silent: true });
}

const SCHEMA_PATH = 'schemas/kb.schema.json';
const OUT_FILE = 'src/data/resources/resources.json';

// load canonical schema
const schemaRaw = await fs.readFile(SCHEMA_PATH, 'utf8');
const SCHEMA = JSON.parse(schemaRaw);

// Initialize Supabase client
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Fetch valid roles from ref_role table and update schema dynamically
const { data: rolesData, error: rolesError } = await supabase
  .from('ref_role')
  .select('value')
  .order('sort_order');

if (rolesError) {
  console.warn('Could not fetch roles from ref_role, using schema defaults:', rolesError.message);
} else if (rolesData && rolesData.length > 0) {
  // Update schema with dynamic roles
  SCHEMA.properties.role.enum = rolesData.map((r) => r.value);
  console.log('✓ Loaded roles from database:', SCHEMA.properties.role.enum.join(', '));
}

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

// Fetch resources from Supabase view (includes junction table data)
const { data: dbResources, error } = await supabase
  .from('kb_resource_pretty')
  .select('*')
  .order('date_added', { ascending: false });

if (error) {
  console.error('Error fetching resources from Supabase:', error);
  process.exit(1);
}

if (!dbResources || dbResources.length === 0) {
  console.warn('⚠️  No resources found in database. Check:');
  console.warn('   - PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY are set in .env');
  console.warn('   - kb_resource table has rows with status="published"');
  console.warn('   - Anon key has SELECT permission on kb_resource_pretty view');
}

const items = [];

for (const resource of dbResources || []) {
  // Map database columns to schema format
  const obj = {
    url: resource.url,
    title: resource.title,
    slug: resource.slug,
    source_name: resource.source_name,
    date_published: resource.publication_date,
    date_added: resource.date_added,
    authors: resource.author ? resource.author.split(', ') : [],
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

  // Only include thumbnail if it exists
  if (resource.thumbnail) {
    obj.thumbnail = resource.thumbnail;
  }

  // normalize values, repair summary lengths, and strip extras before validation
  const normalized = normalizeKeys(obj);
  const withValues = normalizeValues(normalized);
  const withSummariesFixed = fixSummaryLengths(withValues);
  const canonical = toCanonicalShape(withSummariesFixed);

  if (!validate(canonical)) {
    const details = ajv.errorsText(validate.errors, { separator: '\n' });
    const extra = Object.keys(withValues).filter((k) => !allowedKeys.has(k));
    console.error(
      `Invalid: ${resource.title}\n${details}${extra.length ? `\nExtra keys: ${extra.join(', ')}` : ''}`,
    );
    process.exit(1);
  }

  items.push(canonical);
}

await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
await fs.writeFile(OUT_FILE, JSON.stringify(items, null, 2));
console.log(`Wrote ${OUT_FILE} (${items.length} items)`);
