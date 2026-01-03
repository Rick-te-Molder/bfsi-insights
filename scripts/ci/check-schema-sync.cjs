#!/usr/bin/env node

/**
 * Check if schema.md needs updating after migration changes
 * Run as pre-commit hook to ensure schema docs stay in sync
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SCHEMA_FILE = 'docs/data-model/schema.md';
const MIGRATIONS_DIR = 'infra/supabase/migrations';

function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-status', { encoding: 'utf8' });
    return output
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const parts = line.trim().split(/\s+/);
        const status = parts[0] ?? '';

        if (status.startsWith('R')) {
          const from = parts[1] ?? '';
          const to = parts[2] ?? '';
          return { status, file: to, from };
        }

        return { status, file: parts[1] ?? '' };
      })
      .filter((entry) => entry.file);
  } catch {
    return [];
  }
}

function hasMigrationChanges(stagedFiles) {
  const migrationChanges = stagedFiles.filter(
    (entry) => entry.file.startsWith(MIGRATIONS_DIR) && entry.file.endsWith('.sql'),
  );

  if (!migrationChanges.length) return false;

  // Ignore pure renames/moves; still enforce schema updates for additions/modifications.
  return migrationChanges.some((entry) => !entry.status.startsWith('R'));
}

function isSchemaStaged(stagedFiles) {
  return stagedFiles.some((entry) => entry.file === SCHEMA_FILE);
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
