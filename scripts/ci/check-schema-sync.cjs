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

function hasEnvCredentials() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return false;

  const content = fs.readFileSync(envPath, 'utf8');
  return content.includes('PUBLIC_SUPABASE_URL=') && content.includes('SUPABASE_SERVICE_KEY=');
}

function tryAutoUpdateSchema() {
  if (!hasEnvCredentials()) {
    console.warn('\n⚠️  No .env with Supabase credentials found.');
    console.warn('   Schema sync check skipped (CI will catch this).\n');
    return false;
  }

  console.log('\n📊 Auto-running schema dump...');
  try {
    execSync('npm run dump:schema', { stdio: 'inherit' });
    execSync(`git add ${SCHEMA_FILE}`, { stdio: 'inherit' });
    console.log('✅ Schema updated and staged automatically.\n');
    return true;
  } catch (err) {
    console.error('\n❌ Auto schema dump failed:', err.message);
    console.error('   Please run manually: npm run dump:schema\n');
    return false;
  }
}

function main() {
  const stagedFiles = getStagedFiles();

  // Check if migrations are being committed
  if (hasMigrationChanges(stagedFiles)) {
    if (!isSchemaStaged(stagedFiles)) {
      // Try to auto-update schema
      const success = tryAutoUpdateSchema();
      if (!success) {
        // Graceful fallback: warn but don't block (CI will catch)
        console.warn('⚠️  Continuing without schema update (CI will enforce).\n');
      }
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
