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
const { PARAM_LIMITS } = require('../lib/quality-limits.cjs');
const { isTestFile, matchesPattern } = require('../lib/quality-utils.cjs');
const { analyzeFile } = require('../lib/file-analyzer.cjs');

/**
 * Analyze file with moderate unit tracking enabled (for pre-commit warnings)
 */
function analyzeFileWithModerate(filePath) {
  return analyzeFile(filePath, { includeModerate: true });
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

  console.log(
    `\n📋 Checking ${stagedFiles.length} staged file(s) for Quality Gate compliance...\n`,
  );
  console.log('🧹 Boy Scout Rule: All touched files must meet Quality Guidelines\n');

  // Check ALL staged files - no exceptions
  // If you touch it, you must clean it
  const results = stagedFiles.map(analyzeFileWithModerate);

  // Separate results by severity
  const filesExceedingLimit = results.filter((r) => r.exceedsFileLimit);
  const filesWithLargeUnits = results.filter((r) => r.units.large.length > 0);
  const filesWithModerateUnits = results.filter(
    (r) => r.units.moderate.length > 0 && r.units.large.length === 0,
  );
  const filesWithLargeParamUnits = results.filter((r) => r.units.largeParams.length > 0);
  const filesWithModerateParamUnits = results.filter(
    (r) => r.units.moderateParams.length > 0 && r.units.largeParams.length === 0,
  );

  let hasErrors = false;
  let hasWarnings = false;

  // Report files exceeding size limit
  if (filesExceedingLimit.length > 0) {
    hasErrors = true;
    console.error('\n🔴 FILES EXCEEDING SIZE LIMIT:\n');
    console.error('   ⚠️  IMPORTANT: The GOAL is max 200-250 lines, not just <300.');
    console.error('   ⚠️  Refactor to max 200-250 lines, not to 299 lines.\n');
    const sortedFilesExceedingLimit = [...filesExceedingLimit].sort(
      (a, b) => b.lineCount - a.lineCount,
    );
    for (const result of sortedFilesExceedingLimit) {
      const isTest = isTestFile(result.filePath);
      const goal = isTest ? 'goal: max 400-450 lines' : 'goal: max 200-250 lines';
      console.error(`  ❌ ${result.filePath}`);
      console.error(`     ${result.lineCount} lines → refactor to ${goal}\n`);
    }
  }

  // Report files with too many parameters
  if (filesWithLargeParamUnits.length > 0) {
    hasErrors = true;
    console.error('\n🔴 FILES WITH TOO MANY PARAMETERS (>= 6):\n');
    console.error('   ⚠️  IMPORTANT: The GOAL is ≤3 params (max 4), not just <6.');
    console.error('   ⚠️  Use an options object or extract logic.\n');
    for (const result of filesWithLargeParamUnits) {
      console.error(`  ❌ ${result.filePath}`);
      const sortedLargeParamUnits = [...result.units.largeParams].sort(
        (a, b) => b.effectiveParamCount - a.effectiveParamCount,
      );
      for (const unit of sortedLargeParamUnits) {
        const label =
          unit.destructuredKeysCount > PARAM_LIMITS.maxDestructuredKeys
            ? `${unit.effectiveParamCount} keys`
            : `${unit.effectiveParamCount} params`;
        console.error(`     - ${unit.name}(): ${label} → refactor to ≤3 params`);
      }
      console.error('');
    }
  }

  // Report files with large units
  if (filesWithLargeUnits.length > 0) {
    hasErrors = true;
    console.error('\n🔴 FILES WITH LARGE UNITS (exceeds 30-line limit):\n');
    console.error('   ⚠️  IMPORTANT: The GOAL is max 15-20 lines per function, not just <30.');
    console.error('   ⚠️  Refactor to max 15-20 lines, not to 29 lines.\n');
    for (const result of filesWithLargeUnits) {
      const isTest = isTestFile(result.filePath);
      const goal = isTest ? 'goal: max 25-30 lines' : 'goal: max 15-20 lines';
      console.error(`  ❌ ${result.filePath}`);
      const sortedLargeUnits = [...result.units.large].sort((a, b) => b.length - a.length);
      for (const unit of sortedLargeUnits) {
        console.error(`     - ${unit.name}(): ${unit.length} lines → refactor to ${goal}`);
      }
      console.error('');
    }
  }

  // Report files with moderate units (functions 15-30 lines) as warnings
  if (filesWithModerateUnits.length > 0) {
    hasWarnings = true;
    console.warn('\n🟡 FILES WITH MODERATE UNITS (functions/methods 15-30 lines):\n');
    console.warn('   These are acceptable but could be improved for better maintainability.\n');
    for (const result of filesWithModerateUnits.slice(0, 10)) {
      // Limit to top 10
      console.warn(`  ⚠️  ${result.filePath}`);
      const sortedModerateUnits = [...result.units.moderate].sort((a, b) => b.length - a.length);
      const topUnits = sortedModerateUnits.slice(0, 3);
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
    for (const result of filesWithModerateParamUnits.slice(0, 10)) {
      // Limit to top 10
      console.warn(`  ⚠️  ${result.filePath}`);
      const sortedModerateParamUnits = [...result.units.moderateParams].sort(
        (a, b) => b.effectiveParamCount - a.effectiveParamCount,
      );
      const topUnits = sortedModerateParamUnits.slice(0, 3);
      for (const unit of topUnits) {
        const label =
          unit.destructuredKeysCount > PARAM_LIMITS.maxDestructuredKeys
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
  const stagedViolationCount =
    filesExceedingLimit.length + filesWithLargeUnits.length + filesWithLargeParamUnits.length;

  if (!hasErrors && !hasWarnings) {
    console.log(`✅ All staged files meet Quality Guidelines!`);
    console.log(`   Checked: ${results.length} file(s)`);
    console.log(`\n🧹 Boy Scout Rule in action - code left cleaner than found!\n`);
  } else {
    console.error('\n📊 SUMMARY:');

    if (stagedViolationCount === 0) {
      console.error(`   ✅ No violations in staged files:`);
    } else {
      console.error(`   ❌ Violations in staged files:`);
    }

    console.error(`      Files exceeding size limit: ${filesExceedingLimit.length}`);
    console.error(`      Files with large units: ${filesWithLargeUnits.length}`);
    console.error(`      Files with too many parameters: ${filesWithLargeParamUnits.length}`);
    console.error('\n💡 Quality Gate - GOALS vs LIMITS:');
    console.error('   ──────────────────────────────────────────────────');
    console.error('   🎯 GOAL (what to aim for):');
    console.error('      - Functions: max 15-20 lines (source), max 25-30 lines (tests)');
    console.error('      - Files: max 200-250 lines');
    console.error('   🚨 LIMIT (blocks commit if exceeded):');
    console.error('      - Functions: max 30 lines (source), max 50 lines (tests)');
    console.error('      - Files: max 300 lines (source), max 500 lines (tests)');
    console.error('   ──────────────────────────────────────────────────');
    console.error('   Parameters: <=3 optimal, 4-5 warn, >=6 block');
    console.error('\n🧹 Boy Scout Rule:');
    console.error(
      '   - If you touch a file, you MUST clean it to the GOAL, not just under the LIMIT',
    );
    console.error('   - Refactoring to 29 lines when limit is 30 is NOT acceptable');
    console.error('\n🔧 To fix: Extract into smaller functions until you reach max 15-20 lines\n');
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
