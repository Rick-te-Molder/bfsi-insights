/* global process */
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

// Files that are temporarily allowed to exceed limits
// TODO(KB-151): Gradually refactor and remove entries from allowList.
const ALLOW_LIST = new Set([
  // All large files have been refactored! 🎉
  // Keep this structure for future files that may exceed the limit
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
 * Main execution
 */
try {
  const files = execSync(`git ls-files ${patterns.map(p => `"${p}"`).join(' ')}`, { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean)
    .filter((f) => !ALLOW_LIST.has(f));

  const results = files.map(analyzeFile);
  
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
  if (!hasErrors && !hasWarnings) {
    const totalFiles = results.length;
    const allowListSize = ALLOW_LIST.size;
    if (allowListSize > 0) {
      console.log(`✅ All files meet SIG guidelines (${totalFiles} files checked, ${allowListSize} on allow-list)`);
    } else {
      console.log(`✅ All files meet SIG guidelines (${totalFiles} files checked)`);
    }
  } else {
    console.error('\n📊 SUMMARY:');
    console.error(`   Files exceeding size limit: ${filesExceedingLimit.length}`);
    console.error(`   Files with large units (>30 lines): ${filesWithLargeUnits.length}`);
    console.error(`   Files with moderate units (15-30 lines): ${filesWithModerateUnits.length}`);
    console.error('\n💡 SIG Recommendations:');
    console.error('   - Files should be < 300 lines');
    console.error('   - Functions should be < 15 lines (excellent) or < 30 lines (acceptable)');
    console.error('   - Consider extracting large functions into smaller, focused units\n');
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
