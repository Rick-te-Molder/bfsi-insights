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

const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: 'full' });
addFormats(ajv);
ajv.addFormat('uri', true);
ajv.addFormat('date', true);
ajv.addFormat('date-time', true);

const validate = ajv.compile(SCHEMA);

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

  if (!validate(obj)) {
    const details = ajv.errorsText(validate.errors, { separator: '\n' });
    // extra keys hint (only meaningful if additionalProperties=false)
    const allowed = SCHEMA?.properties ? new Set(Object.keys(SCHEMA.properties)) : null;
    const extra = allowed ? Object.keys(obj).filter((k) => !allowed.has(k)) : [];
    console.error(
      `Invalid: ${f}\n${details}${extra.length ? `\nExtra keys: ${extra.join(', ')}` : ''}`,
    );
    process.exit(1);
  }

  items.push(obj);
}

await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
await fs.writeFile(OUT_FILE, JSON.stringify(items, null, 2));
console.log(`Wrote ${OUT_FILE} (${items.length} items)`);
