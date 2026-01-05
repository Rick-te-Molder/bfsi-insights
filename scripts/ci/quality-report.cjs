/**
 * Quality Report Generator
 *
 * Scans the entire codebase and generates Markdown reports for:
 * - Large files (>300 lines for source, >500 for tests)
 * - Large functions (>30 lines for source, >50 for tests)
 * - Functions with too many parameters (>=6)
 *
 * Output: docs/architecture/quality/nightly-*.md
 *
 * Usage: node scripts/ci/quality-report.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { findUnits } = require('../lib/unit-detector.cjs');

const LANGUAGE_LIMITS = {
  js: { file: 300, unit: 30, unitExcellent: 15 },
  ts: { file: 300, unit: 30, unitExcellent: 15 },
  tsx: { file: 300, unit: 30, unitExcellent: 15 },
  jsx: { file: 300, unit: 30, unitExcellent: 15 },
  astro: { file: 300, unit: 30, unitExcellent: 15 },
  default: { file: 300, unit: 30, unitExcellent: 15 },
};

const TEST_LIMITS = {
  js: { file: 500, unit: 50, unitExcellent: 30 },
  ts: { file: 500, unit: 50, unitExcellent: 30 },
  tsx: { file: 500, unit: 50, unitExcellent: 30 },
  jsx: { file: 500, unit: 50, unitExcellent: 30 },
  default: { file: 500, unit: 50, unitExcellent: 30 },
};

const PARAM_LIMITS = { optimal: 3, warn: 5, block: 6, maxDestructuredKeys: 7 };
const ALLOWED_EXT = new Set(['.ts', '.js', '.tsx', '.jsx', '.astro']);
const ALLOWED_PREFIXES = ['apps/web/', 'apps/admin/src/', 'services/agent-api/'];
const OUTPUT_DIR = 'docs/architecture/quality';

function normalizePath(p) {
  return p.replaceAll('\\', '/');
}

function isTestFile(filePath) {
  const f = normalizePath(filePath);
  return (
    f.includes('__tests__/') || f.includes('.test.') || f.includes('.spec.') || /\/tests?\//.test(f)
  );
}

function getLimits(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const limits = isTestFile(filePath) ? TEST_LIMITS : LANGUAGE_LIMITS;
  return limits[ext] || limits.default;
}

function matchesPattern(file) {
  const f = normalizePath(file);
  const ext = path.extname(f).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) return false;
  if (
    f.includes('dist/') ||
    f.includes('build/') ||
    f.includes('.astro/') ||
    f.includes('node_modules/')
  )
    return false;
  return ALLOWED_PREFIXES.some((prefix) => f.startsWith(prefix));
}

function getAllFiles() {
  const output = execSync('git ls-files', { encoding: 'utf8' });
  return output.trim().split('\n').filter(Boolean).filter(matchesPattern);
}

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const lineCount = lines.length;
  const limits = getLimits(filePath);
  const units = findUnits(content);

  const unitsWithParams = units.map((u) => {
    const paramCount = Number.isFinite(u.paramCount) ? u.paramCount : 0;
    const destructuredKeysCount = Number.isFinite(u.destructuredKeysCount)
      ? u.destructuredKeysCount
      : 0;
    const effectiveParamCount =
      destructuredKeysCount > PARAM_LIMITS.maxDestructuredKeys ? destructuredKeysCount : paramCount;
    return { ...u, paramCount, destructuredKeysCount, effectiveParamCount };
  });

  const largeUnits = unitsWithParams.filter((u) => u.length > limits.unit);
  const largeParamUnits = unitsWithParams.filter(
    (u) => u.effectiveParamCount >= PARAM_LIMITS.block,
  );

  return {
    filePath,
    lineCount,
    limits,
    units: { all: unitsWithParams, large: largeUnits, largeParams: largeParamUnits },
    exceedsFileLimit: lineCount > limits.file,
  };
}

function generateLargeFilesReport(results) {
  const largeFiles = results
    .filter((r) => r.exceedsFileLimit)
    .sort((a, b) => b.lineCount - a.lineCount);
  const date = new Date().toISOString().split('T')[0];

  let md = `# Large Files Report\n\n`;
  md += `> Auto-generated on ${date} by nightly quality workflow\n\n`;
  md += `Files exceeding size limits (source: 300 lines, test: 500 lines)\n\n`;
  md += `## Summary\n\n`;
  md += `- **Total large files:** ${largeFiles.length}\n\n`;

  if (largeFiles.length === 0) {
    md += `✅ No files exceed size limits!\n`;
  } else {
    md += `## Files\n\n`;
    md += `| File | Lines | Limit | Over by |\n`;
    md += `|------|------:|------:|--------:|\n`;
    for (const r of largeFiles) {
      md += `| \`${r.filePath}\` | ${r.lineCount} | ${r.limits.file} | +${r.lineCount - r.limits.file} |\n`;
    }
  }

  return md;
}

function generateLargeFunctionsReport(results) {
  const filesWithLargeUnits = results.filter((r) => r.units.large.length > 0);
  const allLargeUnits = filesWithLargeUnits.flatMap((r) =>
    r.units.large.map((u) => ({ ...u, filePath: r.filePath, limits: r.limits })),
  );
  allLargeUnits.sort((a, b) => b.length - a.length);
  const date = new Date().toISOString().split('T')[0];

  let md = `# Large Functions Report\n\n`;
  md += `> Auto-generated on ${date} by nightly quality workflow\n\n`;
  md += `Functions exceeding size limits (source: 30 lines, test: 50 lines)\n\n`;
  md += `## Summary\n\n`;
  md += `- **Total large functions:** ${allLargeUnits.length}\n`;
  md += `- **Files affected:** ${filesWithLargeUnits.length}\n\n`;

  if (allLargeUnits.length === 0) {
    md += `✅ No functions exceed size limits!\n`;
  } else {
    md += `## Functions\n\n`;

    const headerLines = 'LINES';
    const headerFn = 'FUNCTION';
    const headerFile = 'FILE';

    const linesWidth = Math.max(
      headerLines.length,
      ...allLargeUnits.map((u) => String(u.length).length),
    );
    const fnWidth = Math.min(
      48,
      Math.max(headerFn.length, ...allLargeUnits.map((u) => `${u.name}()`.length)),
    );
    const fileWidth = Math.min(
      80,
      Math.max(headerFile.length, ...allLargeUnits.map((u) => u.filePath.length)),
    );

    const padRight = (s, w) => String(s).padEnd(w, ' ');
    const padLeft = (s, w) => String(s).padStart(w, ' ');
    const clamp = (s, w) => {
      const text = String(s);
      if (text.length <= w) return text;
      return `…${text.slice(text.length - (w - 1))}`;
    };

    md += '```text\n';
    md += `${padRight(headerLines, linesWidth)}  ${padRight(headerFn, fnWidth)}  ${padRight(headerFile, fileWidth)}\n`;
    md += `${'-'.repeat(linesWidth)}  ${'-'.repeat(fnWidth)}  ${'-'.repeat(fileWidth)}\n`;
    for (const u of allLargeUnits) {
      const fnName = clamp(`${u.name}()`, fnWidth);
      const fileName = clamp(u.filePath, fileWidth);
      md += `${padLeft(u.length, linesWidth)}  ${padRight(fnName, fnWidth)}  ${padRight(fileName, fileWidth)}\n`;
    }
    md += '```\n';
  }

  return md;
}

function generateParamCountsReport(results) {
  const filesWithLargeParams = results.filter((r) => r.units.largeParams.length > 0);
  const allLargeParamUnits = filesWithLargeParams.flatMap((r) =>
    r.units.largeParams.map((u) => ({ ...u, filePath: r.filePath })),
  );
  allLargeParamUnits.sort((a, b) => b.effectiveParamCount - a.effectiveParamCount);
  const date = new Date().toISOString().split('T')[0];

  let md = `# High Parameter Count Report\n\n`;
  md += `> Auto-generated on ${date} by nightly quality workflow\n\n`;
  md += `Functions with >=6 parameters (blocking threshold)\n\n`;
  md += `## Summary\n\n`;
  md += `- **Total functions with >=6 params:** ${allLargeParamUnits.length}\n`;
  md += `- **Files affected:** ${filesWithLargeParams.length}\n\n`;

  if (allLargeParamUnits.length === 0) {
    md += `✅ No functions exceed parameter limits!\n`;
  } else {
    md += `## Functions\n\n`;
    md += `| File | Function | Params | Location |\n`;
    md += `|------|----------|-------:|----------|\n`;
    for (const u of allLargeParamUnits) {
      const label =
        u.destructuredKeysCount > PARAM_LIMITS.maxDestructuredKeys
          ? `${u.effectiveParamCount} keys`
          : `${u.effectiveParamCount}`;
      md += `| \`${u.filePath}\` | \`${u.name}()\` | ${label} | L${u.startLine}-${u.endLine} |\n`;
    }
  }

  return md;
}

function generateSummaryReport(results) {
  const largeFiles = results.filter((r) => r.exceedsFileLimit);
  const totalLargeUnits = results.reduce((acc, r) => acc + r.units.large.length, 0);
  const totalLargeParams = results.reduce((acc, r) => acc + r.units.largeParams.length, 0);
  const date = new Date().toISOString().split('T')[0];

  let md = `# Quality Metrics Summary\n\n`;
  md += `> Auto-generated on ${date} by nightly quality workflow\n\n`;
  md += `## Overview\n\n`;
  md += `| Metric | Count | Status |\n`;
  md += `|--------|------:|--------|\n`;
  md += `| Large files (>limit) | ${largeFiles.length} | ${largeFiles.length === 0 ? '✅' : '⚠️'} |\n`;
  md += `| Large functions (>limit) | ${totalLargeUnits} | ${totalLargeUnits === 0 ? '✅' : '⚠️'} |\n`;
  md += `| High param functions (>=6) | ${totalLargeParams} | ${totalLargeParams === 0 ? '✅' : '⚠️'} |\n`;
  md += `| Total files scanned | ${results.length} | |\n\n`;
  md += `## Detailed Reports\n\n`;
  md += `- [Large Files](./nightly-large-files.md)\n`;
  md += `- [Large Functions](./nightly-large-functions.md)\n`;
  md += `- [High Parameter Counts](./nightly-param-counts.md)\n\n`;
  md += `## Trends\n\n`;
  md += `_Historical trend tracking coming soon_\n`;

  return md;
}

function writeReport(filename, content) {
  const filePath = path.join(OUTPUT_DIR, filename);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`  ✅ ${filePath}`);
}

try {
  console.log('📊 Generating Quality Reports...\n');
  const files = getAllFiles();
  console.log(`  Scanning ${files.length} files...\n`);

  const results = files.map(analyzeFile);

  writeReport('nightly-summary.md', generateSummaryReport(results));
  writeReport('nightly-large-files.md', generateLargeFilesReport(results));
  writeReport('nightly-large-functions.md', generateLargeFunctionsReport(results));
  writeReport('nightly-param-counts.md', generateParamCountsReport(results));

  console.log('\n✅ Quality reports generated successfully!\n');
} catch (error) {
  console.error('Error generating quality reports:', error.message);
  process.exit(1);
}
