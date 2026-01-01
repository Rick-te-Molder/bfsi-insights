/**
 * Pipeline State Machine
 * KB-XXX: Formal state machine with validation for Phase 2 readiness
 *
 * Loads valid state transitions from database and enforces them at runtime.
 * All transitions must go through this module to ensure consistency.
 */

import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { loadStatusCodes, getStatusCodes } from './status-codes.js';

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Cached state transitions (loaded from database)
let transitionsCache = null;
let normalTransitions = {}; // from_status -> [to_status, ...]
let manualTransitions = {}; // from_status -> [to_status, ...]

// Working states that should auto-transition on failure
const WORKING_STATES = [111, 121, 211, 221, 231]; // fetching, scoring, summarizing, tagging, thumbnailing

/**
 * Load state transitions from database
 */
async function loadStateTransitions() {
  if (transitionsCache) return transitionsCache;

  const { data, error } = await supabase
    .from('state_transitions')
    .select('from_status, to_status, is_manual, description')
    .order('from_status');

  if (error) {
    console.error('Failed to load state transitions from database:', error.message);
    throw new Error(`Cannot load state transitions: ${error.message}`);
  }

  // Build transition maps
  normalTransitions = {};
  manualTransitions = {};

  for (const row of data) {
    const { from_status, to_status, is_manual } = row;

    if (is_manual) {
      if (!manualTransitions[from_status]) {
        manualTransitions[from_status] = [];
      }
      manualTransitions[from_status].push(to_status);
    } else {
      if (!normalTransitions[from_status]) {
        normalTransitions[from_status] = [];
      }
      normalTransitions[from_status].push(to_status);
    }
  }

  transitionsCache = data;
  console.log(`   🔀 Loaded ${data.length} state transitions from database`);
  return transitionsCache;
}

/**
 * Initialize state machine (loads status codes and transitions)
 */
export async function initStateMachine() {
  await loadStatusCodes();
  await loadStateTransitions();
}

/**
 * Reload state transitions from database (for testing or after updates)
 */
export async function reloadStateMachine() {
  transitionsCache = null;
  normalTransitions = {};
  manualTransitions = {};
  await loadStateTransitions();
}

/**
 * Check if a state transition is valid
 * @param {number} fromState - Current status code
 * @param {number} toState - Target status code
 * @param {boolean} isManual - Whether this is a manual override
 * @returns {boolean} - True if transition is valid
 */
export function isValidTransition(fromState, toState, isManual = false) {
  if (!transitionsCache) {
    throw new Error('State machine not initialized. Call initStateMachine() first.');
  }

  // Allow same-state transitions (idempotent updates)
  if (fromState === toState) {
    return true;
  }

  // Check normal transitions
  const allowedStates = normalTransitions[fromState] || [];
  if (allowedStates.includes(toState)) {
    return true;
  }

  // Check manual transitions if applicable
  if (isManual) {
    const manualStates = manualTransitions[fromState] || [];
    if (manualStates.includes(toState)) {
      return true;
    }
  }

  return false;
}

/**
 * Get all valid next states for a given state
 * @param {number} currentState - Current status code
 * @param {boolean} includeManual - Include manual override transitions
 * @returns {number[]} - Array of valid next status codes
 */
export function getValidNextStates(currentState, includeManual = false) {
  if (!transitionsCache) {
    throw new Error('State machine not initialized. Call initStateMachine() first.');
  }

  const normalStates = normalTransitions[currentState] || [];

  if (!includeManual) {
    return [...normalStates];
  }

  const manualStates = manualTransitions[currentState] || [];
  return [...new Set([...normalStates, ...manualStates])];
}

/**
 * Validate and execute a state transition
 * @param {number} fromState - Current status code
 * @param {number} toState - Target status code
 * @param {object} options - Transition options
 * @param {boolean} options.isManual - Whether this is a manual override
 * @throws {Error} - If transition is invalid
 */
export function validateTransition(fromState, toState, options = {}) {
  const { isManual = false } = options;

  // Validate transition
  if (!isValidTransition(fromState, toState, isManual)) {
    const statusCodes = getStatusCodes();
    const fromName =
      Object.keys(statusCodes).find((k) => statusCodes[k] === fromState) || fromState;
    const toName = Object.keys(statusCodes).find((k) => statusCodes[k] === toState) || toState;

    const validNext = getValidNextStates(fromState, isManual);
    const validNames = validNext.map(
      (code) => Object.keys(statusCodes).find((k) => statusCodes[k] === code) || code,
    );

    throw new Error(
      `Invalid state transition: ${fromName} (${fromState}) → ${toName} (${toState}). ` +
        `Valid next states: [${validNames.join(', ')}]${isManual ? ' (including manual)' : ''}`,
    );
  }

  return true;
}

/**
 * Check if a state is a working state (agent in progress)
 * @param {number} statusCode - Status code to check
 * @returns {boolean} - True if this is a working state
 */
export function isWorkingState(statusCode) {
  return WORKING_STATES.includes(statusCode);
}

/**
 * Check if a state is terminal (no further transitions)
 * @param {number} statusCode - Status code to check
 * @returns {boolean} - True if this is a terminal state
 */
export function isTerminalState(statusCode) {
  if (!transitionsCache) {
    throw new Error('State machine not initialized. Call initStateMachine() first.');
  }

  const transitions = normalTransitions[statusCode] || [];
  const manual = manualTransitions[statusCode] || [];
  return transitions.length === 0 && manual.length === 0;
}

/**
 * Get the appropriate retry state for a failed state
 * @param {number} failedState - The state that failed
 * @param {number} originalState - The state before entering working state
 * @returns {number} - Status code to retry from
 */
export function getRetryState(failedState, originalState) {
  // Map working states back to their "ready" state
  const retryMap = {
    111: 110, // fetching → to_fetch
    121: 120, // scoring → to_score
    211: 210, // summarizing → to_summarize
    221: 220, // tagging → to_tag
    231: 230, // thumbnailing → to_thumbnail
  };

  return retryMap[failedState] || originalState || 500;
}

/**
 * Get state machine visualization (for debugging/docs)
 * @returns {object} - State machine definition
 */
export function getStateMachine() {
  if (!transitionsCache) {
    throw new Error('State machine not initialized. Call initStateMachine() first.');
  }

  return {
    transitions: normalTransitions,
    manualTransitions: manualTransitions,
    workingStates: WORKING_STATES,
    raw: transitionsCache,
  };
}

/**
 * Export state machine as Mermaid diagram
 * @returns {string} - Mermaid state diagram
 */
export function toMermaidDiagram() {
  if (!transitionsCache) {
    return '// State machine not initialized';
  }

  const statusCodes = getStatusCodes();
  if (!statusCodes) {
    return '// Status codes not loaded';
  }

  const getStatusName = (code) => {
    const name = Object.keys(statusCodes).find((k) => statusCodes[k] === code);
    return name ? name.toLowerCase() : `status_${code}`;
  };

  let diagram = 'stateDiagram-v2\n';

  // Add all normal transitions
  for (const [from, toStates] of Object.entries(normalTransitions)) {
    const fromCode = Number.parseInt(from, 10);
    const fromName = getStatusName(fromCode);

    if (toStates.length === 0) {
      diagram += `    ${fromName} --> [*]\n`;
    } else {
      for (const toCode of toStates) {
        const toName = getStatusName(toCode);
        diagram += `    ${fromName} --> ${toName}\n`;
      }
    }
  }

  // Add manual transitions (dashed lines)
  for (const [from, toStates] of Object.entries(manualTransitions)) {
    const fromCode = Number.parseInt(from, 10);
    const fromName = getStatusName(fromCode);

    for (const toCode of toStates) {
      const toName = getStatusName(toCode);
      diagram += `    ${fromName} -.-> ${toName} : manual\n`;
    }
  }

  return diagram;
}
