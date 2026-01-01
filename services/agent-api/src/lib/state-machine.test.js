/**
 * State Machine Tests
 * KB-XXX: Phase 2 Task 1.1 - Test state machine validation
 */

import { describe, it, expect } from 'vitest';
import {
  isValidTransition,
  validateTransition,
  getValidNextStates,
  isWorkingState,
  isTerminalState,
  getRetryState,
} from './state-machine.js';

// Mock status codes for testing
const STATUS = {
  DISCOVERED: 100,
  TO_FETCH: 110,
  FETCHING: 111,
  FETCHED: 112,
  PENDING_ENRICHMENT: 200,
  TO_SUMMARIZE: 210,
  SUMMARIZING: 211,
  SUMMARIZED: 212,
  TO_TAG: 220,
  TAGGING: 221,
  TAGGED: 222,
  TO_THUMBNAIL: 230,
  THUMBNAILING: 231,
  THUMBNAILED: 232,
  ENRICHED: 240,
  PENDING_REVIEW: 300,
  IN_REVIEW: 310,
  EDITING: 320,
  PUBLISHED: 400,
  UPDATED: 410,
  FAILED: 500,
  UNREACHABLE: 510,
  DUPLICATE: 520,
  IRRELEVANT: 530,
  REJECTED: 540,
  DEAD_LETTER: 599,
};

describe('State Machine', () => {
  describe('Valid Transitions', () => {
    it('should allow discovery phase transitions', () => {
      expect(isValidTransition(STATUS.DISCOVERED, STATUS.TO_FETCH)).toBe(true);
      expect(isValidTransition(STATUS.TO_FETCH, STATUS.FETCHING)).toBe(true);
      expect(isValidTransition(STATUS.FETCHING, STATUS.FETCHED)).toBe(true);
      expect(isValidTransition(STATUS.FETCHED, STATUS.PENDING_ENRICHMENT)).toBe(true);
    });

    it('should allow enrichment phase transitions', () => {
      expect(isValidTransition(STATUS.PENDING_ENRICHMENT, STATUS.TO_SUMMARIZE)).toBe(true);
      expect(isValidTransition(STATUS.TO_SUMMARIZE, STATUS.SUMMARIZING)).toBe(true);
      expect(isValidTransition(STATUS.SUMMARIZING, STATUS.SUMMARIZED)).toBe(true);
      expect(isValidTransition(STATUS.SUMMARIZED, STATUS.TO_TAG)).toBe(true);
      expect(isValidTransition(STATUS.TO_TAG, STATUS.TAGGING)).toBe(true);
      expect(isValidTransition(STATUS.TAGGING, STATUS.TAGGED)).toBe(true);
      expect(isValidTransition(STATUS.TAGGED, STATUS.TO_THUMBNAIL)).toBe(true);
      expect(isValidTransition(STATUS.TO_THUMBNAIL, STATUS.THUMBNAILING)).toBe(true);
      expect(isValidTransition(STATUS.THUMBNAILING, STATUS.THUMBNAILED)).toBe(true);
      expect(isValidTransition(STATUS.THUMBNAILED, STATUS.ENRICHED)).toBe(true);
      expect(isValidTransition(STATUS.ENRICHED, STATUS.PENDING_REVIEW)).toBe(true);
    });

    it('should allow review phase transitions', () => {
      expect(isValidTransition(STATUS.PENDING_REVIEW, STATUS.IN_REVIEW)).toBe(true);
      expect(isValidTransition(STATUS.IN_REVIEW, STATUS.EDITING)).toBe(true);
      expect(isValidTransition(STATUS.EDITING, STATUS.PUBLISHED)).toBe(true);
      expect(isValidTransition(STATUS.IN_REVIEW, STATUS.PUBLISHED)).toBe(true);
    });

    it('should allow failure transitions', () => {
      expect(isValidTransition(STATUS.FETCHING, STATUS.FAILED)).toBe(true);
      expect(isValidTransition(STATUS.SUMMARIZING, STATUS.FAILED)).toBe(true);
      expect(isValidTransition(STATUS.TAGGING, STATUS.FAILED)).toBe(true);
      expect(isValidTransition(STATUS.THUMBNAILING, STATUS.FAILED)).toBe(true);
    });

    it('should allow rejection transitions', () => {
      expect(isValidTransition(STATUS.SUMMARIZING, STATUS.REJECTED)).toBe(true);
      expect(isValidTransition(STATUS.TAGGING, STATUS.REJECTED)).toBe(true);
      expect(isValidTransition(STATUS.PENDING_REVIEW, STATUS.REJECTED)).toBe(true);
    });

    it('should allow same-state transitions (idempotent)', () => {
      expect(isValidTransition(STATUS.TO_SUMMARIZE, STATUS.TO_SUMMARIZE)).toBe(true);
      expect(isValidTransition(STATUS.PENDING_REVIEW, STATUS.PENDING_REVIEW)).toBe(true);
      expect(isValidTransition(STATUS.PUBLISHED, STATUS.PUBLISHED)).toBe(true);
    });
  });

  describe('Invalid Transitions', () => {
    it('should reject skipping enrichment steps', () => {
      expect(isValidTransition(STATUS.TO_SUMMARIZE, STATUS.TO_TAG)).toBe(false);
      expect(isValidTransition(STATUS.TO_TAG, STATUS.TO_THUMBNAIL)).toBe(false);
    });

    it('should reject backward transitions without manual flag', () => {
      expect(isValidTransition(STATUS.PENDING_REVIEW, STATUS.TO_SUMMARIZE)).toBe(false);
      expect(isValidTransition(STATUS.PUBLISHED, STATUS.TO_TAG)).toBe(false);
    });

    it('should reject transitions from terminal states', () => {
      expect(isValidTransition(STATUS.DUPLICATE, STATUS.TO_FETCH)).toBe(false);
      expect(isValidTransition(STATUS.IRRELEVANT, STATUS.TO_SUMMARIZE)).toBe(false);
      expect(isValidTransition(STATUS.REJECTED, STATUS.PENDING_REVIEW)).toBe(false);
    });

    it('should reject invalid cross-phase transitions', () => {
      expect(isValidTransition(STATUS.FETCHING, STATUS.SUMMARIZING)).toBe(false);
      expect(isValidTransition(STATUS.TAGGING, STATUS.PENDING_REVIEW)).toBe(false);
    });
  });

  describe('Manual Transitions', () => {
    it('should allow re-enrichment from review states', () => {
      expect(isValidTransition(STATUS.PENDING_REVIEW, STATUS.TO_SUMMARIZE, true)).toBe(true);
      expect(isValidTransition(STATUS.PENDING_REVIEW, STATUS.TO_TAG, true)).toBe(true);
      expect(isValidTransition(STATUS.IN_REVIEW, STATUS.TO_THUMBNAIL, true)).toBe(true);
    });

    it('should allow re-enrichment from published states', () => {
      expect(isValidTransition(STATUS.PUBLISHED, STATUS.TO_SUMMARIZE, true)).toBe(true);
      expect(isValidTransition(STATUS.PUBLISHED, STATUS.TO_TAG, true)).toBe(true);
      expect(isValidTransition(STATUS.PUBLISHED, STATUS.PENDING_REVIEW, true)).toBe(true);
    });

    it('should still reject invalid manual transitions', () => {
      expect(isValidTransition(STATUS.TO_SUMMARIZE, STATUS.PUBLISHED, true)).toBe(false);
      expect(isValidTransition(STATUS.DUPLICATE, STATUS.TO_FETCH, true)).toBe(false);
    });
  });

  describe('validateTransition', () => {
    it('should not throw for valid transitions', () => {
      expect(() => validateTransition(STATUS.TO_SUMMARIZE, STATUS.SUMMARIZING)).not.toThrow();
      expect(() => validateTransition(STATUS.SUMMARIZING, STATUS.SUMMARIZED)).not.toThrow();
    });

    it('should throw for invalid transitions', () => {
      expect(() => validateTransition(STATUS.TO_SUMMARIZE, STATUS.TO_TAG)).toThrow(
        /Invalid state transition/,
      );
      expect(() => validateTransition(STATUS.DUPLICATE, STATUS.TO_FETCH)).toThrow(
        /Invalid state transition/,
      );
    });

    it('should include valid next states in error message', () => {
      try {
        validateTransition(STATUS.TO_SUMMARIZE, STATUS.PENDING_REVIEW);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err.message).toContain('Valid next states');
      }
    });
  });

  describe('getValidNextStates', () => {
    it('should return correct next states for enrichment', () => {
      const nextStates = getValidNextStates(STATUS.TO_SUMMARIZE);
      expect(nextStates).toEqual([STATUS.SUMMARIZING]);
    });

    it('should return multiple next states where applicable', () => {
      const nextStates = getValidNextStates(STATUS.IN_REVIEW);
      expect(nextStates).toContain(STATUS.EDITING);
      expect(nextStates).toContain(STATUS.PUBLISHED);
      expect(nextStates).toContain(STATUS.REJECTED);
    });

    it('should include manual transitions when requested', () => {
      const normalStates = getValidNextStates(STATUS.PENDING_REVIEW, false);
      const manualStates = getValidNextStates(STATUS.PENDING_REVIEW, true);

      expect(normalStates).not.toContain(STATUS.TO_SUMMARIZE);
      expect(manualStates).toContain(STATUS.TO_SUMMARIZE);
      expect(manualStates).toContain(STATUS.TO_TAG);
      expect(manualStates).toContain(STATUS.TO_THUMBNAIL);
    });

    it('should return empty array for terminal states', () => {
      expect(getValidNextStates(STATUS.DUPLICATE)).toEqual([]);
      expect(getValidNextStates(STATUS.IRRELEVANT)).toEqual([]);
      expect(getValidNextStates(STATUS.REJECTED)).toEqual([]);
    });
  });

  describe('isWorkingState', () => {
    it('should identify working states', () => {
      expect(isWorkingState(STATUS.FETCHING)).toBe(true);
      expect(isWorkingState(STATUS.SUMMARIZING)).toBe(true);
      expect(isWorkingState(STATUS.TAGGING)).toBe(true);
      expect(isWorkingState(STATUS.THUMBNAILING)).toBe(true);
    });

    it('should not identify ready states as working', () => {
      expect(isWorkingState(STATUS.TO_FETCH)).toBe(false);
      expect(isWorkingState(STATUS.TO_SUMMARIZE)).toBe(false);
      expect(isWorkingState(STATUS.TO_TAG)).toBe(false);
      expect(isWorkingState(STATUS.TO_THUMBNAIL)).toBe(false);
    });
  });

  describe('isTerminalState', () => {
    it('should identify terminal states', () => {
      expect(isTerminalState(STATUS.DUPLICATE)).toBe(true);
      expect(isTerminalState(STATUS.IRRELEVANT)).toBe(true);
      expect(isTerminalState(STATUS.REJECTED)).toBe(true);
      expect(isTerminalState(STATUS.DEAD_LETTER)).toBe(true);
    });

    it('should not identify non-terminal states', () => {
      expect(isTerminalState(STATUS.TO_SUMMARIZE)).toBe(false);
      expect(isTerminalState(STATUS.PENDING_REVIEW)).toBe(false);
      expect(isTerminalState(STATUS.FAILED)).toBe(false); // Can retry
    });
  });

  describe('getRetryState', () => {
    it('should map working states back to ready states', () => {
      expect(getRetryState(STATUS.FETCHING, STATUS.TO_FETCH)).toBe(STATUS.TO_FETCH);
      expect(getRetryState(STATUS.SUMMARIZING, STATUS.TO_SUMMARIZE)).toBe(STATUS.TO_SUMMARIZE);
      expect(getRetryState(STATUS.TAGGING, STATUS.TO_TAG)).toBe(STATUS.TO_TAG);
      expect(getRetryState(STATUS.THUMBNAILING, STATUS.TO_THUMBNAIL)).toBe(STATUS.TO_THUMBNAIL);
    });

    it('should return original state for non-working states', () => {
      expect(getRetryState(STATUS.TO_SUMMARIZE, STATUS.TO_SUMMARIZE)).toBe(STATUS.TO_SUMMARIZE);
    });

    it('should return FAILED if no original state provided', () => {
      expect(getRetryState(STATUS.PENDING_REVIEW, null)).toBe(STATUS.FAILED);
    });
  });
});
