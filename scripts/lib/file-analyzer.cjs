/**
 * File Analyzer for Quality Gate
 *
 * Shared file analysis logic for both pre-commit checks and nightly reports.
 */
const fs = require('node:fs');
const { findUnits } = require('./unit-detector.cjs');
const { getLimits } = require('./quality-utils.cjs');
const { PARAM_LIMITS } = require('./quality-limits.cjs');

/**
 * Calculate effective parameter count for a unit
 * @param {object} unit - Unit from findUnits()
 * @returns {object} Unit with paramCount, destructuredKeysCount, effectiveParamCount
 */
function enrichUnitWithParams(unit) {
  const paramCount = Number.isFinite(unit.paramCount) ? unit.paramCount : 0;
  const destructuredKeysCount = Number.isFinite(unit.destructuredKeysCount)
    ? unit.destructuredKeysCount
    : 0;
  const effectiveParamCount =
    destructuredKeysCount > PARAM_LIMITS.maxDestructuredKeys ? destructuredKeysCount : paramCount;
  return { ...unit, paramCount, destructuredKeysCount, effectiveParamCount };
}

/**
 * Analyze a single file for quality metrics
 * @param {string} filePath - Path to file to analyze
 * @param {object} options - Analysis options
 * @param {boolean} options.includeModerate - Include moderate units (15-30 lines) in results
 * @returns {object} Analysis result with units categorized by severity
 */
function analyzeFile(filePath, options = {}) {
  const { includeModerate = false } = options;

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const lineCount = lines.length;
  const limits = getLimits(filePath);

  const units = findUnits(content);
  const unitsWithParams = units.map(enrichUnitWithParams);

  // Filter units by severity
  const largeUnits = unitsWithParams.filter((u) => u.length > limits.unit);
  const largeParamUnits = unitsWithParams.filter(
    (u) => u.effectiveParamCount >= PARAM_LIMITS.block,
  );

  const result = {
    filePath,
    lineCount,
    limits,
    units: {
      all: unitsWithParams,
      large: largeUnits,
      largeParams: largeParamUnits,
    },
    exceedsFileLimit: lineCount > limits.file,
  };

  // Optionally include moderate units (for pre-commit warnings)
  if (includeModerate) {
    result.units.moderate = unitsWithParams.filter(
      (u) => u.length > limits.unitExcellent && u.length <= limits.unit,
    );
    result.units.moderateParams = unitsWithParams.filter(
      (u) =>
        u.effectiveParamCount >= PARAM_LIMITS.optimal + 1 &&
        u.effectiveParamCount <= PARAM_LIMITS.warn,
    );
  }

  return result;
}

module.exports = {
  analyzeFile,
  enrichUnitWithParams,
};
