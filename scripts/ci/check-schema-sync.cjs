#!/usr/bin/env node

/**
 * Check if schema.md needs updating after migration changes
 * Run as pre-commit hook to ensure schema docs stay in sync
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SCHEMA_FILE = 'docs/data-model/schema.md';
const MIGRATIONS_DIR = 'supabase/migrations';

function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only', { encoding: 'utf8' });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function hasMigrationChanges(stagedFiles) {
  return stagedFiles.some(file => 
    file.startsWith(MIGRATIONS_DIR) && file.endsWith('.sql')
  );
}

function isSchemaStaged(stagedFiles) {
  return stagedFiles.includes(SCHEMA_FILE);
}

function getSchemaAge() {
  try {
    const schemaPath = path.join(process.cwd(), SCHEMA_FILE);
    const stats = fs.statSync(schemaPath);
    const ageInDays = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);
    return ageInDays;
  } catch {
    return 999; // File doesn't exist
  }
}

function main() {
  const stagedFiles = getStagedFiles();
  
  // Check if migrations are being committed
  if (hasMigrationChanges(stagedFiles)) {
    if (!isSchemaStaged(stagedFiles)) {
      console.error('\n❌ Migration files changed but schema.md not updated!\n');
      console.error('   Run: npm run dump:schema');
      console.error('   Then: git add docs/data-model/schema.md\n');
      process.exit(1);
    }
  }
  
  // Warn if schema is very old (> 7 days)
  const schemaAge = getSchemaAge();
  if (schemaAge > 7) {
    console.warn(`\n⚠️  Schema documentation is ${Math.floor(schemaAge)} days old`);
    console.warn('   Consider running: npm run dump:schema\n');
    // Don't block commit, just warn
  }
}

main();
