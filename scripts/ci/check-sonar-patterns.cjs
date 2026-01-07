#!/usr/bin/env node
/**
 * Sonar Pattern Regression Check
 *
 * Lightweight pre-commit check that warns when staged files contain patterns
 * we've documented as Sonar lessons/rules. This catches regressions before CI.
 *
 * Usage: node scripts/ci/check-sonar-patterns.cjs [--strict]
 *
 * Quality System Control: C7 (Static analysis - shift left)
 *
 * Patterns are derived from:
 * - docs/architecture/quality/sonar-lessons/*.md
 * - docs/architecture/quality/sonar-rules/*.md
 */
const fs = require('node:fs');
const { execSync } = require('node:child_process');

/**
 * Pattern definitions derived from documented Sonar lessons and rules.
 * Each pattern has:
 * - id: Sonar rule ID
 * - name: Human-readable name
 * - pattern: RegExp to detect the anti-pattern
 * - extensions: File extensions to check
 * - lesson: Path to lesson doc
 */
const PATTERNS = [
  // S3358: Nested ternary operators
  {
    id: 'S3358',
    name: 'Nested ternary operator',
    pattern: /\?[^?:]*\?/,
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    lesson:
      'docs/architecture/quality/sonar-lessons/extract-nested-ternary-operations-into-helper-functions.md',
  },
  // S6479: Array index as React key
  {
    id: 'S6479',
    name: 'Array index used as React key',
    pattern: /key\s*=\s*\{[^}]*\b(i|idx|index)\b[^}]*\}/,
    extensions: ['.tsx', '.jsx'],
    lesson: 'docs/architecture/quality/sonar-lessons/do-not-use-array-index-in-keys.md',
  },
  // S4624: Nested template literals
  {
    id: 'S4624',
    name: 'Nested template literal',
    pattern: /`[^`]*\$\{[^}]*`[^`]*`[^}]*\}[^`]*`/,
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    lesson:
      'docs/architecture/quality/sonar-lessons/refactor-this-code-to-not-use-nested-template-literals.md',
  },
  // S7781: Use replaceAll instead of replace with global regex
  {
    id: 'S7781',
    name: 'Use replaceAll instead of replace with /g',
    pattern: /\.replace\s*\(\s*\/[^/]+\/g\s*,/,
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    lesson:
      'docs/architecture/quality/sonar-lessons/prefer-string-replaceall-over-string-replace.md',
  },
  // S7735: Negated condition with else clause
  {
    id: 'S7735',
    name: 'Negated condition with else clause',
    pattern: /if\s*\(\s*!\s*\w+[^)]*\)\s*\{[^}]*\}\s*else\s*\{/,
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    lesson: 'docs/architecture/quality/sonar-lessons/unexpected-negated-condition.md',
  },
  // S6848: Interactive handlers on non-interactive elements
  {
    id: 'S6848',
    name: 'onClick on non-interactive element (div/span)',
    pattern: /<(div|span)[^>]*\bonClick\b[^>]*>/,
    extensions: ['.tsx', '.jsx'],
    lesson:
      'docs/architecture/quality/sonar-lessons/add-role-and-keyboard-handling-to-interactive-divs.md',
  },
  // S6819: ARIA role instead of native element
  {
    id: 'S6819',
    name: 'ARIA role instead of native element',
    pattern: /<div[^>]*role\s*=\s*["'](button|link|checkbox|radio)["'][^>]*>/,
    extensions: ['.tsx', '.jsx'],
    lesson:
      'docs/architecture/quality/sonar-lessons/use-native-html-elements-instead-of-aria-roles.md',
  },
  // S2301: Boolean selector parameter
  {
    id: 'S2301',
    name: 'Boolean selector parameter',
    pattern: /function\s+\w+\s*\([^)]*:\s*boolean[^)]*\)\s*\{[^}]*if\s*\(\s*\w+\s*\)/,
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    lesson:
      'docs/architecture/quality/sonar-lessons/provide-multiple-methods-instead-of-boolean-selector-parameters.md',
  },
  // S6551: Object stringification without toString
  {
    id: 'S6551',
    name: 'Object in template literal without toString',
    pattern: /`[^`]*\$\{[^}]*\b(error|err|e)\b[^}]*\}[^`]*`/,
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    lesson:
      'docs/architecture/quality/sonar-lessons/will-use-objects-default-stringification-format.md',
  },
  // S6759: React props not marked readonly
  {
    id: 'S6759',
    name: 'React props interface not using Readonly',
    pattern: /interface\s+\w+Props\s*\{/,
    extensions: ['.tsx'],
    lesson: 'docs/architecture/quality/sonar-lessons/mark-react-props-as-read-only.md',
    // This is advisory - hard to detect if Readonly is used
    advisory: true,
  },
];

/**
 * Get staged files from git
 */
function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf8',
    });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Check if file matches any of the extensions
 */
function matchesExtensions(file, extensions) {
  return extensions.some((ext) => file.endsWith(ext));
}

/**
 * Check a file for pattern matches
 */
function checkFile(filePath, patterns) {
  const matches = [];

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    for (const pattern of patterns) {
      if (!matchesExtensions(filePath, pattern.extensions)) continue;

      for (let i = 0; i < lines.length; i++) {
        if (pattern.pattern.test(lines[i])) {
          matches.push({
            ...pattern,
            file: filePath,
            line: i + 1,
            content: lines[i].trim().slice(0, 80),
          });
        }
      }
    }
  } catch {
    // File doesn't exist or can't be read
  }

  return matches;
}

/**
 * Format a match for display
 */
function formatMatch(match) {
  const prefix = match.advisory ? '💡' : '⚠️';
  return `${prefix} [${match.id}] ${match.name}
   ${match.file}:${match.line}
   ${match.content}
   📖 ${match.lesson}`;
}

/**
 * Main entry point
 */
function main() {
  const args = process.argv.slice(2);
  const strict = args.includes('--strict');

  console.log('🔍 Sonar Pattern Regression Check\n');

  const stagedFiles = getStagedFiles();
  if (stagedFiles.length === 0) {
    console.log('✅ No staged files to check');
    process.exit(0);
  }

  console.log(`📋 Checking ${stagedFiles.length} staged file(s) for known Sonar patterns...\n`);

  const allMatches = [];
  for (const file of stagedFiles) {
    const matches = checkFile(file, PATTERNS);
    allMatches.push(...matches);
  }

  // Separate warnings from advisory notices
  const warnings = allMatches.filter((m) => !m.advisory);
  const advisories = allMatches.filter((m) => m.advisory);

  if (warnings.length > 0) {
    console.log(`⚠️  Found ${warnings.length} potential Sonar pattern(s):\n`);
    for (const match of warnings) {
      console.log(formatMatch(match));
      console.log('');
    }
  }

  if (advisories.length > 0) {
    console.log(`💡 Advisory notices (${advisories.length}):\n`);
    for (const match of advisories) {
      console.log(formatMatch(match));
      console.log('');
    }
  }

  if (allMatches.length === 0) {
    console.log('✅ No known Sonar patterns detected in staged files!');
    process.exit(0);
  }

  console.log('---');
  console.log('These patterns have caused Sonar issues before.');
  console.log('Review the linked lessons and consider refactoring.');
  console.log('');

  if (strict && warnings.length > 0) {
    console.log('❌ Strict mode: blocking commit due to detected patterns.');
    process.exit(1);
  }

  console.log('✅ Continuing with commit (warnings only).');
  process.exit(0);
}

main();
