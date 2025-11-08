#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseResources } from '../schemas/resource-schema.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readJson(p) {
  const txt = fs.readFileSync(p, 'utf8');
  return JSON.parse(txt);
}

try {
  const dataPath = path.join(__dirname, '..', 'src', 'data', 'resources', 'resources.json');
  const data = readJson(dataPath);
  const parsed = parseResources(data);
  const count = parsed.length;
  // simple summary
  const missingThumbs = parsed.filter((r) => !r.thumbnail).length;
  const missingDates = parsed.filter((r) => !r.date_published && !r.date_added).length;
  console.log(`Resources validated: ${count}`);
  console.log(`Items without thumbnail: ${missingThumbs}`);
  console.log(`Items missing date (published/added): ${missingDates}`);
} catch (err) {
  console.error('Resource validation failed:\n');
  console.error(err?.message || err);
  process.exit(1);
}
