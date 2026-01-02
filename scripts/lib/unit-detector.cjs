/**
 * Unit (function/method) detection for Quality Gate checking
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

function extractParenContent(text) {
  const start = text.indexOf('(');
  if (start === -1) return '';

  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    if (ch === ')') {
      depth--;
      if (depth === 0) return text.slice(start + 1, i);
    }
  }

  return '';
}

function splitTopLevelCommas(text) {
  const parts = [];
  let start = 0;
  let round = 0;
  let square = 0;
  let curly = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === '\\') {
      escape = true;
      continue;
    }

    if (!inDouble && !inTemplate && ch === "'") inSingle = !inSingle;
    else if (!inSingle && !inTemplate && ch === '"') inDouble = !inDouble;
    else if (!inSingle && !inDouble && ch === '`') inTemplate = !inTemplate;

    if (inSingle || inDouble || inTemplate) continue;

    if (ch === '(') round++;
    else if (ch === ')') round = Math.max(0, round - 1);
    else if (ch === '[') square++;
    else if (ch === ']') square = Math.max(0, square - 1);
    else if (ch === '{') curly++;
    else if (ch === '}') curly = Math.max(0, curly - 1);

    if (ch === ',' && round === 0 && square === 0 && curly === 0) {
      parts.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }

  const last = text.slice(start).trim();
  if (last) parts.push(last);
  return parts;
}

function countDestructuredKeys(paramText) {
  const trimmed = paramText.trim();
  if (!trimmed.startsWith('{')) return 0;

  const open = trimmed.indexOf('{');
  const close = trimmed.lastIndexOf('}');
  if (open === -1 || close === -1 || close <= open) return 0;

  const inside = trimmed.slice(open + 1, close);
  const keys = splitTopLevelCommas(inside)
    .map((p) => p.split(/[:=]/)[0].trim())
    .filter(Boolean);
  return keys.length;
}

function analyzeSignature(signatureText) {
  const paramsText = extractParenContent(signatureText);
  if (!paramsText.trim()) {
    return { paramCount: 0, destructuredKeysCount: 0 };
  }

  const params = splitTopLevelCommas(paramsText).filter(Boolean);
  const destructuredKeysCount = params.length === 1 ? countDestructuredKeys(params[0]) : 0;
  return { paramCount: params.length, destructuredKeysCount };
}

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
  let signatureLines = [];
  let signatureAnalyzed = false;

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
          signatureLines = [line];
          signatureAnalyzed = false;
          break;
        }
      }
    }

    // Track brace depth to find function end
    // Note: This is a heuristic and can be fooled by braces in strings/templates
    if (inUnit) {
      currentUnit.endLine = i + 1;

      if (!signatureAnalyzed && !sawOpeningBrace) {
        if (signatureLines.length > 0 && signatureLines[signatureLines.length - 1] !== line) {
          signatureLines.push(line);
        }
      }

      const opens = (line.match(/{/g) || []).length;
      const closes = (line.match(/}/g) || []).length;
      if (opens > 0) sawOpeningBrace = true;

      if (!signatureAnalyzed && sawOpeningBrace) {
        const signatureText = signatureLines.join('\n');
        const { paramCount, destructuredKeysCount } = analyzeSignature(signatureText);
        currentUnit.paramCount = paramCount;
        currentUnit.destructuredKeysCount = destructuredKeysCount;
        signatureAnalyzed = true;
      }

      braceDepth += opens;
      braceDepth -= closes;

      if (sawOpeningBrace && braceDepth === 0) {
        currentUnit.length = currentUnit.endLine - currentUnit.startLine + 1;
        units.push(currentUnit);
        currentUnit = null;
        inUnit = false;
        signatureLines = [];
        signatureAnalyzed = false;
      }
    }
  }

  return units;
}

module.exports = { findUnits };
