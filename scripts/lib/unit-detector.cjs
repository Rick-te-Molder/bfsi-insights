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
 * Standardized to capture function name in group 2 where possible
 */
const FUNCTION_PATTERNS = [
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
  /^\s*(export\s+)?const\s+(\w+)\s*=\s*(async\s*)?\([^)]*\)\s*=>\s*{/, // const name = () => {
  /^\s*(export\s+)?let\s+(\w+)\s*=\s*(async\s*)?\([^)]*\)\s*=>\s*{/,   // let name = () => {
];

/**
 * Parse file to find function/method boundaries
 * @param {string} content - File content
 * @param {Object} limits - Size limits for this file
 * @returns {Array} Array of units with name, startLine, endLine, length
 */
function findUnits(content, limits) {
  const lines = content.split('\n');
  const units = [];
  
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
      for (const pattern of FUNCTION_PATTERNS) {
        const match = pattern.exec(line);
        if (match) {
          // Extract name from capture groups (try group 2, then 1, then 3)
          const name = match[2] || match[1] || match[3] || 'anonymous';
          currentUnit = {
            name: name.replace(/^(export|public|private|protected)\s+/, ''),
            startLine: i + 1,
            endLine: i + 1,
          };
          inUnit = true;
          braceDepth = 0;
          break;
        }
      }
    }

    // Track brace depth to find function end
    // Note: This is a heuristic and can be fooled by braces in strings/templates
    if (inUnit) {
      for (const char of line) {
        if (char === '{') braceDepth++;
        if (char === '}') braceDepth--;
        
        if (braceDepth === 0 && char === '}') {
          currentUnit.endLine = i + 1;
          currentUnit.length = currentUnit.endLine - currentUnit.startLine + 1;
          units.push(currentUnit);
          currentUnit = null;
          inUnit = false;
          break;
        }
      }
    }
  }

  return units;
}

module.exports = { findUnits };
