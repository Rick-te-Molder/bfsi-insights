// @ts-check
import { describe, it, expect } from 'vitest';
import { classifyError, ErrorType } from '../error-classification.js';

describe('classifyError', () => {
  describe('rate limit errors', () => {
    it('classifies 429 status as rate limit', () => {
      const error = { statusCode: 429, message: 'Too many requests' };
      const result = classifyError(error);
      expect(result.type).toBe(ErrorType.RATE_LIMIT);
      expect(result.retryable).toBe(true);
      expect(result.statusCode).toBe(429);
    });

    it('classifies rate limit message', () => {
      const error = new Error('Rate limit exceeded');
      const result = classifyError(error);
      expect(result.type).toBe(ErrorType.RATE_LIMIT);
      expect(result.retryable).toBe(true);
    });
  });

  describe('server errors', () => {
    it('classifies 500 status as retryable', () => {
      const error = { statusCode: 500, message: 'Internal server error' };
      const result = classifyError(error);
      expect(result.type).toBe(ErrorType.RETRYABLE);
      expect(result.retryable).toBe(true);
      expect(result.statusCode).toBe(500);
    });

    it('classifies 503 status as retryable', () => {
      const error = { statusCode: 503 };
      const result = classifyError(error);
      expect(result.type).toBe(ErrorType.RETRYABLE);
      expect(result.retryable).toBe(true);
    });
  });

  describe('timeout errors', () => {
    it('classifies ETIMEDOUT code as retryable', () => {
      const error = { code: 'ETIMEDOUT', message: 'Connection timeout' };
      const result = classifyError(error);
      expect(result.type).toBe(ErrorType.RETRYABLE);
      expect(result.retryable).toBe(true);
    });

    it('classifies ECONNRESET code as retryable', () => {
      const error = { code: 'ECONNRESET' };
      const result = classifyError(error);
      expect(result.type).toBe(ErrorType.RETRYABLE);
      expect(result.retryable).toBe(true);
    });

    it('classifies timeout message as retryable', () => {
      const error = new Error('Request timeout');
      const result = classifyError(error);
      expect(result.type).toBe(ErrorType.RETRYABLE);
      expect(result.retryable).toBe(true);
    });
  });

  describe('network errors', () => {
    it('classifies ECONNREFUSED code as retryable', () => {
      const error = { code: 'ECONNREFUSED' };
      const result = classifyError(error);
      expect(result.type).toBe(ErrorType.RETRYABLE);
      expect(result.retryable).toBe(true);
    });

    it('classifies ENOTFOUND code as retryable', () => {
      const error = { code: 'ENOTFOUND', message: 'Host not found' };
      const result = classifyError(error);
      expect(result.type).toBe(ErrorType.RETRYABLE);
      expect(result.retryable).toBe(true);
    });
  });

  describe('client errors', () => {
    it('classifies 400 status as terminal', () => {
      const error = { statusCode: 400, message: 'Bad request' };
      const result = classifyError(error);
      expect(result.type).toBe(ErrorType.TERMINAL);
      expect(result.retryable).toBe(false);
      expect(result.statusCode).toBe(400);
    });

    it('classifies 404 status as terminal', () => {
      const error = { statusCode: 404 };
      const result = classifyError(error);
      expect(result.type).toBe(ErrorType.TERMINAL);
      expect(result.retryable).toBe(false);
    });

    it('does not classify 429 as client error', () => {
      const error = { statusCode: 429 };
      const result = classifyError(error);
      expect(result.type).toBe(ErrorType.RATE_LIMIT);
    });
  });

  describe('auth errors', () => {
    it('classifies unauthorized message as terminal', () => {
      const error = new Error('Unauthorized access');
      const result = classifyError(error);
      expect(result.type).toBe(ErrorType.TERMINAL);
      expect(result.retryable).toBe(false);
    });

    it('classifies forbidden message as terminal', () => {
      const error = new Error('Forbidden resource');
      const result = classifyError(error);
      expect(result.type).toBe(ErrorType.TERMINAL);
      expect(result.retryable).toBe(false);
    });
  });

  describe('validation errors', () => {
    it('classifies validation message as terminal', () => {
      const error = new Error('Validation failed');
      const result = classifyError(error);
      expect(result.type).toBe(ErrorType.TERMINAL);
      expect(result.retryable).toBe(false);
    });

    it('classifies invalid message as terminal', () => {
      const error = new Error('Invalid input');
      const result = classifyError(error);
      expect(result.type).toBe(ErrorType.TERMINAL);
      expect(result.retryable).toBe(false);
    });
  });

  describe('unknown errors', () => {
    it('defaults to retryable for unknown errors', () => {
      const error = new Error('Something went wrong');
      const result = classifyError(error);
      expect(result.type).toBe(ErrorType.RETRYABLE);
      expect(result.retryable).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('handles numeric code as statusCode', () => {
      const error = { code: 500, message: 'Server error' };
      const result = classifyError(error);
      expect(result.type).toBe(ErrorType.RETRYABLE);
      expect(result.statusCode).toBe(500);
    });

    it('handles case-insensitive messages', () => {
      const error = new Error('RATE LIMIT EXCEEDED');
      const result = classifyError(error);
      expect(result.type).toBe(ErrorType.RATE_LIMIT);
    });

    it('handles null/undefined error', () => {
      const result = classifyError(null);
      expect(result.type).toBe(ErrorType.RETRYABLE);
      expect(result.retryable).toBe(true);
    });
  });
});
