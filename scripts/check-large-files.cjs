/**
 * Check for files exceeding the line limit threshold
 * Used by both pre-commit hook and CI
 * 
 * KB-151: Continuously refactor large files
 */
const { execSync } = require('node:child_process');
const path = require('node:path');

const MAX_LINES = 500;

// Use git ls-files to only scan tracked files
const patterns = [
  'src/**/*.ts',
  'src/**/*.js', 
  'src/**/*.astro',
  'services/agent-api/src/**/*.ts',
  'services/agent-api/src/**/*.js',
];

try {
  const files = execSync(`git ls-files ${patterns.map(p => `"${p}"`).join(' ')}`, { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean);

  const largeFiles = [];

  for (const file of files) {
    try {
      const out = execSync(`wc -l < "${file}"`, { encoding: 'utf8' }).trim();
      const lineCount = Number(out);
      if (lineCount > MAX_LINES) {
        largeFiles.push({ file, lineCount });
      }
    } catch {
      // File might not exist or be readable
    }
  }

  if (largeFiles.length) {
    console.error(`\n⚠️  Files exceeding ${MAX_LINES} lines:\n`);
    for (const { file, lineCount } of largeFiles.sort((a, b) => b.lineCount - a.lineCount)) {
      console.error(`  - ${file} (${lineCount} lines)`);
    }
    console.error(`\nConsider refactoring these files into smaller modules.\n`);
    process.exit(1);
  }

  console.log(`✅ All files are under ${MAX_LINES} lines`);
  process.exit(0);
} catch (error) {
  console.error('Error checking file sizes:', error.message);
  process.exit(1);
}
