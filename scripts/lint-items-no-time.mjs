#!/usr/bin/env node
import fs from 'node:fs';

const dir = 'src/data/resources/items';
const bad = [];

for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  const o = JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8'));
  if ('time' in o) bad.push(f);
}

if (bad.length) {
  console.error("Forbidden key 'time' found in:", bad.join(', '));
  process.exit(1);
}

console.log('OK');
