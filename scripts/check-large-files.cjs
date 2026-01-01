/**
 * SIG-compliant code size checker
 * Checks both file size and unit (function/method) size based on SIG maintainability guidelines
 * 
 * KB-151: Continuously refactor large files and functions
 * 
 * References:
 * - SIG Maintainability Model: https://www.softwareimprovementgroup.com/
 * - "Building Maintainable Software" by Joost Visser
 */
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

// SIG-based thresholds per language
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

// Files with known violations (for tracking purposes only - NOT used for filtering)
// TODO(KB-151): Gradually refactor and remove entries from this list.
// 
// BOY SCOUT RULE: If you touch any file, it MUST meet SIG guidelines before commit.
// This list is for documentation only - all staged files are checked regardless.
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

// Patterns to scan
const patterns = [
  'src/**/*.ts',
  'src/**/*.js',
  'src/**/*.tsx',
  'src/**/*.jsx',
  'src/**/*.astro',
  'services/agent-api/src/**/*.ts',
  'services/agent-api/src/**/*.js',
  'admin-next/src/**/*.ts',
  'admin-next/src/**/*.tsx',
];

/**
 * Get language-specific limits
 */
function getLimits(filePath) {
  const ext = path.extname(filePath).slice(1);
  return LANGUAGE_LIMITS[ext] || LANGUAGE_LIMITS.default;
}

/**
 * Parse file to find function/method boundaries
 * Simple heuristic-based parser for JS/TS
 */
function findUnits(filePath, content) {
  const lines = content.split('\n');
  const units = [];
  const limits = getLimits(filePath);
  
  // Patterns that indicate function/method start
  const functionPatterns = [
    /^\s*function\s+(\w+)/,                    // function name()
    /^\s*const\s+(\w+)\s*=\s*\(/,              // const name = (
    /^\s*const\s+(\w+)\s*=\s*async\s*\(/,      // const name = async (
    /^\s*async\s+function\s+(\w+)/,            // async function name()
    /^\s*(\w+)\s*\([^)]*\)\s*{/,               // name() {
    /^\s*async\s+(\w+)\s*\([^)]*\)\s*{/,       // async name() {
    /^\s*export\s+function\s+(\w+)/,           // export function name()
    /^\s*export\s+async\s+function\s+(\w+)/,   // export async function name()
    /^\s*export\s+default\s+function\s+(\w+)?/, // export default function
    /^\s*(public|private|protected)\s+(\w+)\s*\(/,  // class methods
  ];

  let currentUnit = null;
  let braceDepth = 0;
  let inUnit = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      continue;
    }

    // Check if this line starts a function
    if (!inUnit) {
      for (const pattern of functionPatterns) {
        const match = line.match(pattern);
        if (match) {
          currentUnit = {
            name: match[1] || match[2] || 'anonymous',
            startLine: i + 1,
            endLine: i + 1,
          };
          inUnit = true;
          braceDepth = 0;
          break;
        }
      }
    }

    if (inUnit) {
      // Track brace depth
      for (const char of line) {
        if (char === '{') braceDepth++;
        if (char === '}') braceDepth--;
      }

      currentUnit.endLine = i + 1;

      // Function ends when braces balance
      if (braceDepth === 0 && line.includes('}')) {
        const unitLength = currentUnit.endLine - currentUnit.startLine + 1;
        
        // Only report units that exceed the excellent threshold
        if (unitLength > limits.unitExcellent) {
          units.push({
            ...currentUnit,
            length: unitLength,
          });
        }
        
        inUnit = false;
        currentUnit = null;
      }
    }
  }

  return units;
}

/**
 * Analyze a single file
 */
function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const lineCount = lines.length;
  const limits = getLimits(filePath);
  
  const units = findUnits(filePath, content);
  
  // Filter units by severity
  const largeUnits = units.filter(u => u.length > limits.unit);
  const moderateUnits = units.filter(u => u.length > limits.unitExcellent && u.length <= limits.unit);
  
  return {
    filePath,
    lineCount,
    limits,
    units: {
      all: units,
      large: largeUnits,      // > 30 lines (poor)
      moderate: moderateUnits, // 15-30 lines (good but could be better)
    },
    exceedsFileLimit: lineCount > limits.file,
  };
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
    
    // Filter by patterns
    const matchesPattern = (file) => {
      return patterns.some(pattern => {
        const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
        return regex.test(file);
      });
    };
    
    return staged.filter(matchesPattern);
  } catch (err) {
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
  
  console.log(`\n📋 Checking ${stagedFiles.length} staged file(s) for SIG compliance...\n`);
  console.log('🧹 Boy Scout Rule: All touched files must meet SIG guidelines\n');
  
  // Check ALL staged files - no exceptions
  // If you touch it, you must clean it
  const results = stagedFiles.map(analyzeFile);
  
  // Separate results by severity
  const filesExceedingLimit = results.filter(r => r.exceedsFileLimit);
  const filesWithLargeUnits = results.filter(r => r.units.large.length > 0);
  const filesWithModerateUnits = results.filter(r => r.units.moderate.length > 0 && r.units.large.length === 0);
  
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

  // Report files with large units (functions > 30 lines)
  if (filesWithLargeUnits.length > 0) {
    hasErrors = true;
    console.error('\n🔴 FILES WITH LARGE UNITS (functions/methods > 30 lines):\n');
    for (const result of filesWithLargeUnits) {
      console.error(`  ❌ ${result.filePath}`);
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

  // Summary
  const knownViolators = stagedFiles.filter(f => ALLOW_LIST.has(f));
  
  if (!hasErrors && !hasWarnings) {
    console.log(`✅ All staged files meet SIG guidelines!`);
    console.log(`   Checked: ${results.length} file(s)`);
    if (knownViolators.length > 0) {
      console.log(`   🎉 Cleaned up: ${knownViolators.length} file(s) that previously had violations`);
      console.log(`   Remove from ALLOW_LIST: ${knownViolators.map(f => f).join(', ')}`);
    }
    console.log(`\n🧹 Boy Scout Rule in action - code left cleaner than found!\n`);
  } else {
    console.error('\n📊 SUMMARY:');
    console.error(`   ❌ Violations in staged files:`);
    console.error(`      Files exceeding size limit (>300 lines): ${filesExceedingLimit.length}`);
    console.error(`      Files with large units (>30 lines): ${filesWithLargeUnits.length}`);
    if (knownViolators.length > 0) {
      console.error(`\n   📋 ${knownViolators.length} file(s) on known violations list:`);
      knownViolators.forEach(f => console.error(`      - ${f}`));
      console.error(`   These files must be refactored before commit (Boy Scout Rule)`);
    }
    console.error(`\n   � Total known violations: ${ALLOW_LIST.size} file(s) (tracked for cleanup)`);
    console.error('\n💡 SIG Requirements (enforced for ALL touched files):');
    console.error('   - Files MUST be < 300 lines');
    console.error('   - Functions MUST be < 30 lines');
    console.error('   - Functions SHOULD be < 15 lines (excellent)');
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
