#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const itemsDir = path.join(__dirname, '../src/data/resources/items');

const files = fs.readdirSync(itemsDir).filter((f) => f.endsWith('.json'));

console.log(`Migrating ${files.length} resource files: jurisdiction → geography\n`);

let updated = 0;

for (const file of files) {
  const filePath = path.join(itemsDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(content);

  if (data.jurisdiction) {
    data.geography = data.jurisdiction;
    delete data.jurisdiction;

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
    console.log(`✓ ${file}`);
    updated++;
  }
}

console.log(`\n✅ Updated ${updated}/${files.length} files`);
