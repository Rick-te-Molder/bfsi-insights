#!/usr/bin/env node
/**
 * Coverage Delta Check
 *
 * Compares current coverage against baseline and fails if coverage drops.
 * Used in Fast CI to enforce "test alongside" development.
 *
 * Usage: node scripts/ci/check-coverage-delta.cjs [--baseline <path>] [--current <path>]
 *
 * Quality System Control: C6 (Tests + coverage)
 */
const fs = require('node:fs');

// Configuration
const CONFIG = {
  // Maximum allowed coverage drop (percentage points)
  maxDrop: 1,
  // Minimum coverage threshold (absolute)
  minCoverage: 80,
  // Default paths
  baselinePath: 'artifacts/coverage-baseline.json',
  currentPath: 'services/agent-api/coverage/coverage-summary.json',
};

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const result = { ...CONFIG };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--baseline' && args[i + 1]) {
      result.baselinePath = args[++i];
    } else if (args[i] === '--current' && args[i + 1]) {
      result.currentPath = args[++i];
    } else if (args[i] === '--max-drop' && args[i + 1]) {
      result.maxDrop = Number.parseFloat(args[++i]);
    } else if (args[i] === '--min-coverage' && args[i + 1]) {
      result.minCoverage = Number.parseFloat(args[++i]);
    }
  }

  return result;
}

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
 * Main entry point
 */
function main() {
  const config = parseArgs();

  console.log('📊 Coverage Delta Check\n');

  // Read current coverage (required)
  const currentSummary = readCoverageSummary(config.currentPath);
  if (!currentSummary) {
    console.error(`❌ Current coverage not found: ${config.currentPath}`);
    console.error('   Run tests with coverage first: npm run test:coverage -w services/agent-api');
    process.exit(1);
  }

  const current = extractCoverage(currentSummary);
  if (!current) {
    console.error('❌ Invalid coverage summary format');
    process.exit(1);
  }

  console.log('📈 Current Coverage:');
  console.log(`   Lines:      ${formatPct(current.lines)}`);
  console.log(`   Statements: ${formatPct(current.statements)}`);
  console.log(`   Functions:  ${formatPct(current.functions)}`);
  console.log(`   Branches:   ${formatPct(current.branches)}`);
  console.log('');

  // Check minimum threshold
  const belowThreshold = checkMinimumThreshold(current, config.minCoverage);
  if (belowThreshold.length > 0) {
    console.log(`⚠️  Below Minimum Threshold (${config.minCoverage}%):`);
    for (const { metric, value, threshold } of belowThreshold) {
      console.log(`   ${metric}: ${formatPct(value)} < ${formatPct(threshold)}`);
    }
    console.log('');
  }

  // Read baseline coverage (optional)
  const baselineSummary = readCoverageSummary(config.baselinePath);
  if (!baselineSummary) {
    console.log(`ℹ️  No baseline found at: ${config.baselinePath}`);
    console.log('   This is expected on first run or when baseline is not yet established.');
    console.log('   Skipping delta comparison.\n');

    // Still fail if below minimum threshold
    if (belowThreshold.length > 0) {
      console.log('❌ Coverage below minimum threshold!');
      process.exit(1);
    }

    console.log('✅ Coverage check passed (no baseline comparison)');
    process.exit(0);
  }

  const baseline = extractCoverage(baselineSummary);
  if (!baseline) {
    console.error('⚠️  Invalid baseline coverage format, skipping delta comparison');
    process.exit(0);
  }

  console.log('📉 Baseline Coverage:');
  console.log(`   Lines:      ${formatPct(baseline.lines)}`);
  console.log(`   Statements: ${formatPct(baseline.statements)}`);
  console.log(`   Functions:  ${formatPct(baseline.functions)}`);
  console.log(`   Branches:   ${formatPct(baseline.branches)}`);
  console.log('');

  // Compare coverage
  const { regressions, improvements } = compareCoverage(baseline, current, config.maxDrop);

  if (improvements.length > 0) {
    console.log('🎉 Coverage Improvements:');
    for (const { metric, baseline: b, current: c, delta } of improvements) {
      console.log(`   ${metric}: ${formatPct(b)} → ${formatPct(c)} (${formatDelta(delta)})`);
    }
    console.log('');
  }

  if (regressions.length > 0) {
    console.log(`❌ Coverage Regressions (max allowed drop: ${config.maxDrop}%):`);
    for (const { metric, baseline: b, current: c, delta } of regressions) {
      console.log(`   ${metric}: ${formatPct(b)} → ${formatPct(c)} (${formatDelta(delta)})`);
    }
    console.log('');
    console.log('💡 To fix: Add tests for your new code before committing.');
    console.log('   Run: npm run test:coverage -w services/agent-api');
    process.exit(1);
  }

  if (belowThreshold.length > 0) {
    console.log('❌ Coverage below minimum threshold!');
    process.exit(1);
  }

  console.log('✅ Coverage check passed!');
  process.exit(0);
}

main();
