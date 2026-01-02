/**
 * Quality Gate code size checker
 * Checks both file size and unit (function/method) size based on Quality Guidelines
 * 
 * KB-151: Continuously refactor large files and functions
 * 
 * References:
 * - Maintainability model (Software Improvement Group): https://www.softwareimprovementgroup.com/
 * - "Building Maintainable Software" by Joost Visser
 */
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { findUnits } = require('./lib/unit-detector.cjs');

// 300/30 size limits per language
const LANGUAGE_LIMITS = {
  'js': { file: 300, unit: 30, unitExcellent: 15 },
  'ts': { file: 300, unit: 30, unitExcellent: 15 },
  'tsx': { file: 300, unit: 30, unitExcellent: 15 },
  'jsx': { file: 300, unit: 30, unitExcellent: 15 },
  'astro': { file: 300, unit: 30, unitExcellent: 15 },
  'py': { file: 250, unit: 25, unitExcellent: 15 },
  'java': { file: 300, unit: 30, unitExcellent: 15 },
  'default': { file: 300, unit: 30, unitExcellent: 15 },
};

// Relaxed limits for test files (allow longer test tables/fixtures)
const TEST_LIMITS = {
  'js': { file: 500, unit: 50, unitExcellent: 30 },
  'ts': { file: 500, unit: 50, unitExcellent: 30 },
  'tsx': { file: 500, unit: 50, unitExcellent: 30 },
  'jsx': { file: 500, unit: 50, unitExcellent: 30 },
  'default': { file: 500, unit: 50, unitExcellent: 30 },
};

const PARAM_LIMITS = {
  optimal: 3,
  warn: 5,
  block: 6,
  maxDestructuredKeys: 7,
};

// Files with known violations (for tracking purposes only - NOT used for filtering)
// TODO(KB-151): Gradually refactor and remove entries from this list.
// 
// NOTE: This allow-list is INFORMATIONAL ONLY; it does NOT affect enforcement.
// All staged files are checked regardless of whether they're on this list.
// 
// BOY SCOUT RULE: If you touch any file, it MUST meet Quality Guidelines before commit.
// 
// Known violations as of 2026-01-02:
// - 31 files > 300 lines
// - ~117 additional files with functions > 30 lines
// 
// When you modify a file on this list, you must refactor it to pass checks.
// Leave the code cleaner than you found it.
//
const ALLOW_LIST = new Set([
  // Files > 300 lines (31 files) - must be refactored when touched
  'services/agent-api/src/agents/scorer.js',
  'src/features/publications/publication-filters.ts',
  'admin-next/src/app/(dashboard)/items/page.tsx',
  'services/agent-api/src/routes/agents.js',
  'src/features/publications/multi-select-filters.ts',
  'services/agent-api/src/agents/thumbnailer.js',
  'services/agent-api/src/routes/agent-jobs.js',
  'services/agent-api/src/agents/improver.js',
  'services/agent-api/src/lib/content-fetcher.js',
  'src/features/publications/PublicationCard.astro',
  'admin-next/src/app/(dashboard)/evals/golden-sets/page.tsx',
  'services/agent-api/src/agents/tagger.js',
  'admin-next/src/app/(dashboard)/missed/components/MissedForm.tsx',
  'services/agent-api/src/lib/evals.js',
  'admin-next/src/components/tags/TagDisplay.tsx',
  'src/components/FilterPanel.astro',
  'services/agent-api/src/lib/sitemap.js',
  'src/layouts/Base.astro',
  'services/agent-api/src/cli/commands/pipeline.js',
  'services/agent-api/src/agents/discoverer.js',
  'admin-next/src/app/(dashboard)/items/[id]/page.tsx',
  'services/agent-api/src/lib/runner.js',
  'admin-next/src/app/(dashboard)/items/[id]/enrichment-panel.tsx',
  'admin-next/src/app/(dashboard)/items/actions.ts',
  'admin-next/src/app/(dashboard)/items/[id]/evaluation-panel.tsx',
  'services/agent-api/src/lib/semantic-scholar.js',
  'src/features/publications/multi-filters/chips.ts',
  'services/agent-api/src/agents/orchestrator.js',
  'admin-next/src/app/(dashboard)/items/review-list.tsx',
  'services/agent-api/src/agents/discover-classics.js',
  'admin-next/src/app/(dashboard)/items/[id]/actions.tsx',
]);

// Allowed file extensions and path prefixes
const ALLOWED_EXT = new Set(['.ts', '.js', '.tsx', '.jsx', '.astro']);
const ALLOWED_PREFIXES = [
  'src/',
  'admin-next/src/',
  'services/agent-api/', // includes src/ and __tests__/
];

/**
 * Normalize path for cross-platform compatibility
 */
function normalizePath(p) {
  return p.replaceAll('\\', '/');
}

/**
 * Check if file is a test file
 */
function isTestFile(filePath) {
  const f = normalizePath(filePath);
  return (
    f.includes('__tests__/') ||
    f.includes('.test.') ||
    f.includes('.spec.') ||
    /\/tests?\//.test(f)
  );
}

/**
 * Get language-specific limits
 */
function getLimits(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const limits = isTestFile(filePath) ? TEST_LIMITS : LANGUAGE_LIMITS;
  return limits[ext] || limits.default;
}

/**
 * Analyze a single file
 */
function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const lineCount = lines.length;
  const limits = getLimits(filePath);
  
  const units = findUnits(content);

  const unitsWithParams = units.map((u) => {
    const paramCount = Number.isFinite(u.paramCount) ? u.paramCount : 0;
    const destructuredKeysCount = Number.isFinite(u.destructuredKeysCount) ? u.destructuredKeysCount : 0;
    const effectiveParamCount = destructuredKeysCount > PARAM_LIMITS.maxDestructuredKeys
      ? destructuredKeysCount
      : paramCount;
    return { ...u, paramCount, destructuredKeysCount, effectiveParamCount };
  });
  
  // Filter units by severity
  const largeUnits = unitsWithParams.filter(u => u.length > limits.unit);
  const moderateUnits = unitsWithParams.filter(u => u.length > limits.unitExcellent && u.length <= limits.unit);

  const largeParamUnits = unitsWithParams.filter(u => u.effectiveParamCount >= PARAM_LIMITS.block);
  const moderateParamUnits = unitsWithParams.filter(
    u => u.effectiveParamCount >= (PARAM_LIMITS.optimal + 1) && u.effectiveParamCount <= PARAM_LIMITS.warn,
  );
  
  return {
    filePath,
    lineCount,
    limits,
    units: {
      all: unitsWithParams,
      large: largeUnits,      // > 30 lines (poor)
      moderate: moderateUnits, // 15-30 lines (good but could be better)
      largeParams: largeParamUnits,
      moderateParams: moderateParamUnits,
    },
    exceedsFileLimit: lineCount > limits.file,
  };
}

/**
 * Check if file matches our criteria (extension + path prefix)
 */
function matchesPattern(file) {
  const f = normalizePath(file);
  const ext = path.extname(f).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) return false;
  // Exclude generated/build folders
  if (f.includes('dist/') || f.includes('build/') || f.includes('.astro/') || f.includes('node_modules/')) return false;
  return ALLOWED_PREFIXES.some(prefix => f.startsWith(prefix));
}

/**
 * Get staged files (for pre-commit check)
 */
function getStagedFiles() {
  try {
    const staged = execSync('git diff --cached --name-only --diff-filter=AM', { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(Boolean);
    
    // Filter by extension and path prefix (simpler and more reliable than glob-regex)
    return staged.filter(matchesPattern);
  } catch {
    // No staged files or not in a git repo
    return [];
  }
}

/**
 * Main execution
 */
try {
  // Check only staged files (new/modified code)
  const stagedFiles = getStagedFiles();
  
  if (stagedFiles.length === 0) {
    console.log('✅ No staged files to check');
    process.exit(0);
  }
  
  console.log(`\n📋 Checking ${stagedFiles.length} staged file(s) for Quality Gate compliance...\n`);
  console.log('🧹 Boy Scout Rule: All touched files must meet Quality Guidelines\n');
  
  // Check ALL staged files - no exceptions
  // If you touch it, you must clean it
  const results = stagedFiles.map(analyzeFile);
  
  // Separate results by severity
  const filesExceedingLimit = results.filter(r => r.exceedsFileLimit);
  const filesWithLargeUnits = results.filter(r => r.units.large.length > 0);
  const filesWithModerateUnits = results.filter(r => r.units.moderate.length > 0 && r.units.large.length === 0);
  const filesWithLargeParamUnits = results.filter(r => r.units.largeParams.length > 0);
  const filesWithModerateParamUnits = results.filter(
    r => r.units.moderateParams.length > 0 && r.units.largeParams.length === 0,
  );
  
  let hasErrors = false;
  let hasWarnings = false;

  // Report files exceeding size limit
  if (filesExceedingLimit.length > 0) {
    hasErrors = true;
    console.error('\n🔴 FILES EXCEEDING SIZE LIMIT:\n');
    for (const result of filesExceedingLimit.sort((a, b) => b.lineCount - a.lineCount)) {
      console.error(`  ❌ ${result.filePath}`);
      console.error(`     ${result.lineCount} lines (limit: ${result.limits.file})`);
      console.error(`     Exceeds by: ${result.lineCount - result.limits.file} lines\n`);
    }
  }

  // Report files with too many parameters
  if (filesWithLargeParamUnits.length > 0) {
    hasErrors = true;
    console.error('\n🔴 FILES WITH TOO MANY PARAMETERS (>= 6):\n');
    for (const result of filesWithLargeParamUnits) {
      console.error(`  ❌ ${result.filePath}`);
      for (const unit of result.units.largeParams.sort((a, b) => b.effectiveParamCount - a.effectiveParamCount)) {
        const label = unit.destructuredKeysCount > PARAM_LIMITS.maxDestructuredKeys
          ? `${unit.effectiveParamCount} keys`
          : `${unit.effectiveParamCount} params`;
        console.error(`     - ${unit.name}(): ${label} (lines ${unit.startLine}-${unit.endLine})`);
      }
      console.error('');
    }
  }

  // Report files with large units
  if (filesWithLargeUnits.length > 0) {
    hasErrors = true;
    console.error('\n🔴 FILES WITH LARGE UNITS:\n');
    for (const result of filesWithLargeUnits) {
      const isTest = isTestFile(result.filePath);
      const limit = isTest ? 'test files: >50 lines' : 'source files: >30 lines';
      console.error(`  ❌ ${result.filePath} (${limit})`);
      for (const unit of result.units.large.sort((a, b) => b.length - a.length)) {
        console.error(`     - ${unit.name}(): ${unit.length} lines (lines ${unit.startLine}-${unit.endLine})`);
      }
      console.error('');
    }
  }

  // Report files with moderate units (functions 15-30 lines) as warnings
  if (filesWithModerateUnits.length > 0) {
    hasWarnings = true;
    console.warn('\n🟡 FILES WITH MODERATE UNITS (functions/methods 15-30 lines):\n');
    console.warn('   These are acceptable but could be improved for better maintainability.\n');
    for (const result of filesWithModerateUnits.slice(0, 10)) { // Limit to top 10
      console.warn(`  ⚠️  ${result.filePath}`);
      const topUnits = result.units.moderate.sort((a, b) => b.length - a.length).slice(0, 3);
      for (const unit of topUnits) {
        console.warn(`     - ${unit.name}(): ${unit.length} lines`);
      }
      console.warn('');
    }
    if (filesWithModerateUnits.length > 10) {
      console.warn(`  ... and ${filesWithModerateUnits.length - 10} more files\n`);
    }
  }

  if (filesWithModerateParamUnits.length > 0) {
    hasWarnings = true;
    console.warn('\n🟡 FILES WITH MODERATE PARAMETER COUNTS (4-5):\n');
    console.warn('   These are allowed but should usually be refactored for clarity.\n');
    for (const result of filesWithModerateParamUnits.slice(0, 10)) { // Limit to top 10
      console.warn(`  ⚠️  ${result.filePath}`);
      const topUnits = result.units.moderateParams
        .sort((a, b) => b.effectiveParamCount - a.effectiveParamCount)
        .slice(0, 3);
      for (const unit of topUnits) {
        const label = unit.destructuredKeysCount > PARAM_LIMITS.maxDestructuredKeys
          ? `${unit.effectiveParamCount} keys`
          : `${unit.effectiveParamCount} params`;
        console.warn(`     - ${unit.name}(): ${label}`);
      }
      console.warn('');
    }
    if (filesWithModerateParamUnits.length > 10) {
      console.warn(`  ... and ${filesWithModerateParamUnits.length - 10} more files\n`);
    }
  }

  // Summary
  const knownViolators = stagedFiles.filter(f => ALLOW_LIST.has(f));
  
  if (!hasErrors && !hasWarnings) {
    console.log(`✅ All staged files meet Quality Guidelines!`);
    console.log(`   Checked: ${results.length} file(s)`);
    if (knownViolators.length > 0) {
      console.log(`   🎉 Cleaned up: ${knownViolators.length} file(s) that previously had violations`);
      console.log(`   Remove from ALLOW_LIST: ${knownViolators.map(f => f).join(', ')}`);
    }
    console.log(`\n🧹 Boy Scout Rule in action - code left cleaner than found!\n`);
  } else {
    console.error('\n📊 SUMMARY:');
    console.error(`   ❌ Violations in staged files:`);
    console.error(`      Files exceeding size limit: ${filesExceedingLimit.length}`);
    console.error(`      Files with large units: ${filesWithLargeUnits.length}`);
    console.error(`      Files with too many parameters: ${filesWithLargeParamUnits.length}`);
    if (knownViolators.length > 0) {
      console.error(`\n   📋 ${knownViolators.length} file(s) on known violations list:`);
      knownViolators.forEach(f => console.error(`      - ${f}`));
      console.error(`   These files must be refactored before commit (Boy Scout Rule)`);
    }
    console.error(`\n   📋 Total known violations: ${ALLOW_LIST.size} file(s) (tracked for cleanup)`);
    console.error('\n💡 Quality Gate Requirements (enforced for ALL touched files):');
    console.error('   Source files: <300 lines, functions <30 lines');
    console.error('   Test files: <500 lines, functions <50 lines (relaxed for fixtures/tables)');
    console.error('   Functions SHOULD be <15 lines (excellent) for all files');
    console.error('   Parameters: <=3 optimal, 4-5 warn, >=6 block');
    console.error('   Options/context objects: >7 keys treated like too many parameters');
    console.error('\n🧹 Boy Scout Rule:');
    console.error('   - If you touch a file, you MUST clean it');
    console.error('   - No exceptions - even for files with known violations');
    console.error('   - Leave the code cleaner than you found it');
    console.error('\n🔧 To fix: Extract large functions into smaller, focused units\n');
  }

  // Exit with error if there are violations
  if (hasErrors) {
    process.exit(1);
  }
  
  process.exit(0);
} catch (error) {
  console.error('Error checking file sizes:', error.message);
  process.exit(1);
}
