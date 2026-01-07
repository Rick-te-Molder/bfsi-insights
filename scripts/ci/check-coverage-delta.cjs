#!/usr/bin/env node
/**
 * Coverage Delta Check
 *
 * Compares current coverage against baseline and fails if coverage drops.
 * Used in Fast CI to enforce "test alongside" development.
 *
 * Checks multiple workspaces:
 * - services/agent-api (80% threshold - critical backend)
 * - apps/web + apps/admin (via root vitest - 60% threshold, growing)
 *
 * Usage: node scripts/ci/check-coverage-delta.cjs
 *
 * Quality System Control: C6 (Tests + coverage)
 */
const fs = require('node:fs');

// Workspace configurations
const WORKSPACES = [
  {
    name: 'agent-api',
    currentPath: 'services/agent-api/coverage/coverage-summary.json',
    baselinePath: 'artifacts/coverage-baseline-agent-api.json',
    minCoverage: 80,
    maxDrop: 1,
  },
  {
    name: 'apps (web + admin)',
    currentPath: 'artifacts/test/coverage/coverage-summary.json',
    baselinePath: 'artifacts/coverage-baseline-apps.json',
    minCoverage: 60, // Lower threshold while growing coverage
    maxDrop: 2,
  },
];

/**
 * Read coverage summary JSON
 * @param {string} filePath - Path to coverage-summary.json
 * @returns {object|null} Coverage data or null if not found
 */
function readCoverageSummary(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Extract overall coverage percentage from summary
 * @param {object} summary - Coverage summary object
 * @returns {object} Coverage percentages by metric
 */
function extractCoverage(summary) {
  if (!summary || !summary.total) {
    return null;
  }

  const { total } = summary;
  return {
    lines: total.lines?.pct ?? 0,
    statements: total.statements?.pct ?? 0,
    functions: total.functions?.pct ?? 0,
    branches: total.branches?.pct ?? 0,
  };
}

/**
 * Compare coverage and check for regressions
 * @param {object} baseline - Baseline coverage
 * @param {object} current - Current coverage
 * @param {number} maxDrop - Maximum allowed drop
 * @returns {object} Comparison result
 */
function compareCoverage(baseline, current, maxDrop) {
  const metrics = ['lines', 'statements', 'functions', 'branches'];
  const regressions = [];
  const improvements = [];

  for (const metric of metrics) {
    const baseVal = baseline?.[metric] ?? 0;
    const currVal = current?.[metric] ?? 0;
    const delta = currVal - baseVal;

    if (delta < -maxDrop) {
      regressions.push({ metric, baseline: baseVal, current: currVal, delta });
    } else if (delta > 0.5) {
      improvements.push({ metric, baseline: baseVal, current: currVal, delta });
    }
  }

  return { regressions, improvements };
}

/**
 * Check if current coverage meets minimum threshold
 * @param {object} current - Current coverage
 * @param {number} minCoverage - Minimum threshold
 * @returns {object[]} Metrics below threshold
 */
function checkMinimumThreshold(current, minCoverage) {
  const metrics = ['lines', 'statements', 'functions', 'branches'];
  const belowThreshold = [];

  for (const metric of metrics) {
    const val = current?.[metric] ?? 0;
    if (val < minCoverage) {
      belowThreshold.push({ metric, value: val, threshold: minCoverage });
    }
  }

  return belowThreshold;
}

/**
 * Format percentage for display
 */
function formatPct(val) {
  return `${val.toFixed(2)}%`;
}

/**
 * Format delta for display
 */
function formatDelta(delta) {
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta.toFixed(2)}%`;
}

/**
 * Check a single workspace
 * @param {object} workspace - Workspace configuration
 * @returns {object} Result with passed, regressions, belowThreshold
 */
function checkWorkspace(workspace) {
  console.log(`\n📦 ${workspace.name}`);
  console.log('─'.repeat(40));

  const currentSummary = readCoverageSummary(workspace.currentPath);
  if (!currentSummary) {
    console.log(`   ⏭️  No coverage found (skipping): ${workspace.currentPath}`);
    return { passed: true, skipped: true };
  }

  const current = extractCoverage(currentSummary);
  if (!current) {
    console.log('   ⚠️  Invalid coverage format');
    return { passed: true, skipped: true };
  }

  console.log(
    `   Lines: ${formatPct(current.lines)} | Funcs: ${formatPct(current.functions)} | Branches: ${formatPct(current.branches)}`,
  );

  const belowThreshold = checkMinimumThreshold(current, workspace.minCoverage);
  const baselineSummary = readCoverageSummary(workspace.baselinePath);
  const baseline = baselineSummary ? extractCoverage(baselineSummary) : null;

  let regressions = [];
  if (baseline) {
    const comparison = compareCoverage(baseline, current, workspace.maxDrop);
    regressions = comparison.regressions;
    if (comparison.improvements.length > 0) {
      const improvementList = comparison.improvements
        .map((i) => i.metric + ' ' + formatDelta(i.delta))
        .join(', ');
      console.log('   🎉 Improvements: ' + improvementList);
    }
  } else {
    console.log(`   ℹ️  No baseline (first run)`);
  }

  if (regressions.length > 0) {
    const regressionList = regressions.map((r) => r.metric + ' ' + formatDelta(r.delta)).join(', ');
    console.log('   ❌ Regressions: ' + regressionList);
  }

  if (belowThreshold.length > 0) {
    console.log(
      `   ⚠️  Below ${workspace.minCoverage}%: ${belowThreshold.map((b) => b.metric).join(', ')}`,
    );
  }

  // Only enforce minimum threshold if we have a baseline
  // First run = no enforcement, just establishes baseline
  const hasBaseline = baseline !== null;
  const thresholdFailure = hasBaseline && belowThreshold.length > 0;
  const passed = regressions.length === 0 && !thresholdFailure;

  if (passed) {
    console.log('   ✅ Passed');
  }

  return { passed, regressions, belowThreshold, current };
}

/**
 * Main entry point
 */
function main() {
  console.log('📊 Coverage Delta Check');
  console.log('═'.repeat(40));

  let hasFailures = false;

  for (const workspace of WORKSPACES) {
    const result = checkWorkspace(workspace);
    if (!result.passed && !result.skipped) {
      hasFailures = true;
    }
  }

  console.log('\n' + '═'.repeat(40));

  if (hasFailures) {
    console.log('❌ Coverage check failed!');
    console.log('💡 Add tests for your new code before committing.');
    console.log('   npm run test:coverage              # root (apps)');
    console.log('   npm run test:coverage -w services/agent-api');
    process.exit(1);
  }

  console.log('✅ All coverage checks passed!');
  process.exit(0);
}

main();
