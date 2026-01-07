#!/usr/bin/env node
/**
 * Dependency Hygiene Check
 *
 * Warns when staged changes add new dependencies to package.json.
 * Part of AI-assisted development guardrails (Control C13).
 *
 * Usage: node scripts/ci/check-new-dependencies.cjs
 *
 * Quality System Control: C13 (Dependency hygiene)
 */
const { execSync } = require('node:child_process');

console.log('📦 Dependency Hygiene Check\n');

/**
 * Get staged diff for package.json files
 */
function getStagedPackageJsonDiff() {
  try {
    const output = execSync('git diff --cached --unified=0 -- "**/package.json"', {
      encoding: 'utf8',
    });
    return output;
  } catch {
    return '';
  }
}

/**
 * Parse added dependencies from diff
 */
function parseAddedDependencies(diff) {
  const added = [];
  const lines = diff.split('\n');

  for (const line of lines) {
    if (!line.startsWith('+') || line.startsWith('+++')) continue;

    const match = line.match(/^\+\s*"([^"]+)":\s*"([^"]+)"/);
    if (!match) continue;

    const [, name, version] = match;
    const isScoped = name.startsWith('@');
    const hasSlash = name.includes('/');
    const isSemver = /^[\^~]?\d|workspace:|npm:|file:/.test(version);

    if ((isScoped || !hasSlash) && isSemver) {
      added.push({ name, version });
    }
  }

  return added;
}

/**
 * Check if dependency was already in package.json before this change
 */
function wasExistingDependency(name) {
  try {
    const headContent = execSync('git show HEAD:package.json', {
      encoding: 'utf8',
    });
    const pkg = JSON.parse(headContent);
    return (
      (pkg.dependencies && name in pkg.dependencies) ||
      (pkg.devDependencies && name in pkg.devDependencies) ||
      (pkg.peerDependencies && name in pkg.peerDependencies)
    );
  } catch {
    return false;
  }
}

/**
 * Main check
 */
function main() {
  const diff = getStagedPackageJsonDiff();

  if (!diff) {
    console.log('✅ No package.json changes staged\n');
    return;
  }

  const addedDeps = parseAddedDependencies(diff);
  const newDeps = addedDeps.filter((dep) => !wasExistingDependency(dep.name));

  if (newDeps.length === 0) {
    console.log('✅ No new dependencies added\n');
    return;
  }

  console.log('⚠️  New dependencies detected:\n');
  for (const dep of newDeps) {
    console.log(`   📦 ${dep.name}@${dep.version}`);
  }

  console.log('\n');
  console.log('┌─────────────────────────────────────────────────────────┐');
  console.log('│              DEPENDENCY HYGIENE REMINDER                │');
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log('│ Before adding new dependencies, verify:                 │');
  console.log('│                                                         │');
  console.log('│ □ Is this necessary? Can existing deps handle it?       │');
  console.log('│ □ Is it actively maintained? (recent commits)           │');
  console.log('│ □ Is it secure? (check npm audit, snyk)                 │');
  console.log('│ □ Is the license compatible? (MIT, Apache, etc.)        │');
  console.log('│ □ Is it documented in PR description?                   │');
  console.log('└─────────────────────────────────────────────────────────┘');
  console.log('');
  console.log('Include justification in your PR description:');
  console.log('');
  console.log('  ## New Dependencies');
  console.log('  - `package-name` - [why needed, alternatives considered]');
  console.log('');

  // This is a warning, not a blocker
  // Exit 0 to allow commit, but the warning is visible
}

main();
