#!/usr/bin/env node
/**
 * Sonar Pattern Regression Check
 *
 * Lightweight pre-commit check that warns when staged files contain patterns
 * we've documented as Sonar lessons/rules. This catches regressions before CI.
 *
 * Patterns are DYNAMICALLY LOADED from:
 * - docs/architecture/quality/sonar-lessons/*.md (YAML frontmatter)
 *
 * When you add a new lesson with frontmatter, it's automatically included.
 *
 * Usage: node scripts/ci/check-sonar-patterns.cjs [--strict]
 *
 * Quality System Control: C7 (Static analysis - shift left)
 */
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const PATTERN_DIRS = [
  'docs/architecture/quality/sonar-lessons',
  'docs/architecture/quality/sonar-rules',
];

/**
 * Parse YAML frontmatter from markdown file
 * @param {string} content - File content
 * @returns {object|null} Parsed frontmatter or null
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const yaml = match[1];
  const result = {};

  for (const line of yaml.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();

    // Parse arrays like [".ts", ".tsx"]
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replaceAll(/^["']|["']$/g, ''));
    }
    // Parse booleans
    else if (value === 'true') {
      value = true;
    } else if (value === 'false') {
      value = false;
    }
    // Remove quotes from strings
    else {
      value = value.replaceAll(/^["']|["']$/g, '');
    }

    // Handle escaped backslashes in patterns
    if (key === 'pattern' && typeof value === 'string') {
      value = value.replaceAll('\\\\', '\x00').replaceAll('\\', '').replaceAll('\x00', '\\');
    }

    result[key] = value;
  }

  return result;
}

/**
 * Load patterns from markdown files with YAML frontmatter
 * @returns {object[]} Array of pattern definitions
 */
function loadPatternsFromDocs() {
  const patterns = [];
  const seenIds = new Set();

  for (const dir of PATTERN_DIRS) {
    try {
      const files = fs.readdirSync(dir);

      for (const file of files) {
        if (!file.endsWith('.md')) continue;

        const filePath = path.join(dir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const frontmatter = parseFrontmatter(content);

        if (!frontmatter || !frontmatter.id || !frontmatter.pattern) continue;

        // Skip duplicates (lessons take precedence over rules)
        if (seenIds.has(frontmatter.id)) continue;
        seenIds.add(frontmatter.id);

        patterns.push({
          id: frontmatter.id,
          name: frontmatter.name || frontmatter.id,
          pattern: new RegExp(frontmatter.pattern),
          extensions: frontmatter.extensions || ['.ts', '.tsx', '.js', '.jsx'],
          lesson: filePath,
          advisory: frontmatter.advisory || false,
        });
      }
    } catch {
      // Directory may not exist, that's OK
    }
  }

  return patterns;
}

// Load patterns dynamically from docs
const PATTERNS = loadPatternsFromDocs();

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
