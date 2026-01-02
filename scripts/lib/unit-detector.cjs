/**
 * Unit (function/method) detection for SIG compliance checking
 * Uses heuristic-based parsing - not a full parser
 * 
 * Known limitations:
 * - Brace counting can be fooled by strings/templates containing braces
 * - This is acceptable as a "best-effort" gate for pre-commit checks
 * - For 100% accuracy, use a real parser (Acorn/Babel)
 */

/**
 * Patterns that indicate function/method start
 * Function name is consistently captured in group 1
 */
const FUNCTION_PATTERNS = [
  /^\s*function\s+(\w+)/,                    // function name()
  /^\s*async\s+function\s+(\w+)/,            // async function name()
  /^\s*export\s+(?:async\s+)?function\s+(\w+)/, // export [async] function name()
  /^\s*export\s+default\s+function\s*(\w+)?/, // export default function [name]
  /^\s*(\w+)\s*\([^)]*\)\s*{/,               // name() {
  /^\s*async\s+(\w+)\s*\([^)]*\)\s*{/,       // async name() {
  /^\s*(?:public|private|protected)\s+(\w+)\s*\(/, // class methods
  /^\s*(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*{/, // const name = () => {
  /^\s*(?:export\s+)?let\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*{/,   // let name = () => {
];

/**
 * Parse file to find function/method boundaries
 * @param {string} content - File content
 * @returns {Array} Array of units with name, startLine, endLine, length
 */
function findUnits(content) {
  const lines = content.split('\n');
  const units = [];
  
  let currentUnit = null;
  let braceDepth = 0;
  let inUnit = false;
  let sawOpeningBrace = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      continue;
    }

    // Check if this line starts a function
    if (!inUnit) {
      for (const pattern of FUNCTION_PATTERNS) {
        const match = pattern.exec(line);
        if (match) {
          const name = match[1] || 'anonymous';
          currentUnit = {
            name,
            startLine: i + 1,
            endLine: i + 1,
          };
          inUnit = true;
          braceDepth = 0;
          sawOpeningBrace = false;
          break;
        }
      }
    }

    // Track brace depth to find function end
    // Note: This is a heuristic and can be fooled by braces in strings/templates
    if (inUnit) {
      currentUnit.endLine = i + 1;

      const opens = (line.match(/{/g) || []).length;
      const closes = (line.match(/}/g) || []).length;
      if (opens > 0) sawOpeningBrace = true;

      braceDepth += opens;
      braceDepth -= closes;

      if (sawOpeningBrace && braceDepth === 0) {
        currentUnit.length = currentUnit.endLine - currentUnit.startLine + 1;
        units.push(currentUnit);
        currentUnit = null;
        inUnit = false;
      }
    }
  }

  return units;
}

module.exports = { findUnits };
