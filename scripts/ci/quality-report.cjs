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
const { PARAM_LIMITS } = require('../lib/quality-limits.cjs');
const { matchesPattern, padRight, padLeft, clamp } = require('../lib/quality-utils.cjs');
const { analyzeFile } = require('../lib/file-analyzer.cjs');

const OUTPUT_DIR = 'docs/architecture/quality';

function getAllFiles() {
  const output = execSync('git ls-files', { encoding: 'utf8' });
  return output.trim().split('\n').filter(Boolean).filter(matchesPattern);
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

    const headerOver = 'OVER';
    const headerLines = 'LINES';
    const headerFile = 'FILE';

    const overWidth = Math.max(
      headerOver.length,
      ...largeFiles.map((r) => `+${r.lineCount - r.limits.file}`.length),
    );
    const linesWidth = Math.max(
      headerLines.length,
      ...largeFiles.map((r) => String(r.lineCount).length),
    );
    const fileWidth = Math.min(
      90,
      Math.max(headerFile.length, ...largeFiles.map((r) => r.filePath.length)),
    );

    md += '```text\n';
    md += `${padRight(headerOver, overWidth)}  ${padRight(headerLines, linesWidth)}  ${padRight(headerFile, fileWidth)}\n`;
    md += `${'-'.repeat(overWidth)}  ${'-'.repeat(linesWidth)}  ${'-'.repeat(fileWidth)}\n`;
    for (const r of largeFiles) {
      const overBy = `+${r.lineCount - r.limits.file}`;
      const fileName = clamp(r.filePath, fileWidth);
      md += `${padLeft(overBy, overWidth)}  ${padLeft(r.lineCount, linesWidth)}  ${padRight(fileName, fileWidth)}\n`;
    }
    md += '```\n';
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

    const headerParams = 'PARAMS';
    const headerFn = 'FUNCTION';
    const headerFile = 'FILE';

    const labels = allLargeParamUnits.map((u) =>
      u.destructuredKeysCount > PARAM_LIMITS.maxDestructuredKeys
        ? `${u.effectiveParamCount} keys`
        : `${u.effectiveParamCount}`,
    );

    const paramsWidth = Math.max(headerParams.length, ...labels.map((l) => l.length));
    const fnWidth = Math.min(
      48,
      Math.max(headerFn.length, ...allLargeParamUnits.map((u) => `${u.name}()`.length)),
    );
    const fileWidth = Math.min(
      80,
      Math.max(headerFile.length, ...allLargeParamUnits.map((u) => u.filePath.length)),
    );

    md += '```text\n';
    md += `${padRight(headerParams, paramsWidth)}  ${padRight(headerFn, fnWidth)}  ${padRight(headerFile, fileWidth)}\n`;
    md += `${'-'.repeat(paramsWidth)}  ${'-'.repeat(fnWidth)}  ${'-'.repeat(fileWidth)}\n`;
    for (let i = 0; i < allLargeParamUnits.length; i++) {
      const u = allLargeParamUnits[i];
      const label = labels[i];
      const fnName = clamp(`${u.name}()`, fnWidth);
      const fileName = clamp(u.filePath, fileWidth);
      md += `${padLeft(label, paramsWidth)}  ${padRight(fnName, fnWidth)}  ${padRight(fileName, fileWidth)}\n`;
    }
    md += '```\n';
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
