#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applySummaries } from './lib/summary-applier.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REVIEW_FILE = path.join(__dirname, '..', 'summaries-review.json');
const ITEMS_DIR = path.join(__dirname, '..', 'src', 'data', 'resources', 'items');

async function main() {
  console.log('🚀 Applying approved summaries...\n');

  const result = await applySummaries(REVIEW_FILE, ITEMS_DIR);

  if (result.errors.length > 0) {
    console.log('❌ Errors:');
    result.errors.forEach((e) => {
      console.log(`   ${e.filename}: ${e.error}`);
    });
  }

  console.log(`\n✅ Applied summaries to ${result.updated.length} files:`);
  result.updated.forEach((f) => console.log(`   - ${f}`));

  console.log('\n💡 Next: Run "npm run build:resources" to rebuild resources.json');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
