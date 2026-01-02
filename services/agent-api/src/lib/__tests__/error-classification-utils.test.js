// @ts-check
import { describe, it, expect } from 'vitest';
import {
  calculateBackoff,
  shouldMoveToDLQ,
  getRetryDelay,
  formatError,
  ErrorType,
  BackoffConfig,
} from '../error-classification.js';

describe('calculateBackoff', () => {
  it('calculates exponential backoff', () => {
    const delay1 = calculateBackoff(1);
    const delay2 = calculateBackoff(2);
    const delay3 = calculateBackoff(3);

    expect(delay1).toBeGreaterThanOrEqual(BackoffConfig.base * 0.8);
    expect(delay1).toBeLessThanOrEqual(BackoffConfig.base * 1.2);
    expect(delay2).toBeGreaterThan(delay1);
    expect(delay3).toBeGreaterThan(delay2);
  });

  it('uses longer base for rate limits', () => {
    const normalDelay = calculateBackoff(1, ErrorType.RETRYABLE);
    const rateLimitDelay = calculateBackoff(1, ErrorType.RATE_LIMIT);
    expect(rateLimitDelay).toBeGreaterThan(normalDelay);
  });

  it('caps at max delay', () => {
    const delay = calculateBackoff(100);
    expect(delay).toBeLessThanOrEqual(BackoffConfig.max * 1.2);
  });

  it('handles invalid attempt numbers', () => {
    const delay0 = calculateBackoff(0);
    const delayNegative = calculateBackoff(-5);
    expect(delay0).toBeGreaterThan(0);
    expect(delayNegative).toBeGreaterThan(0);
  });

  it('adds jitter to prevent thundering herd', () => {
    const delays = Array.from({ length: 10 }, () => calculateBackoff(2));
    const uniqueDelays = new Set(delays);
    expect(uniqueDelays.size).toBeGreaterThan(1);
  });
});

describe('shouldMoveToDLQ', () => {
  it('moves terminal errors to DLQ immediately', () => {
    const classification = { type: ErrorType.TERMINAL, retryable: false, reason: 'Test' };
    expect(shouldMoveToDLQ(1, classification)).toBe(true);
  });

  it('does not move retryable errors below threshold', () => {
    const classification = { type: ErrorType.RETRYABLE, retryable: true, reason: 'Test' };
    expect(shouldMoveToDLQ(1, classification)).toBe(false);
    expect(shouldMoveToDLQ(2, classification)).toBe(false);
  });

  it('moves retryable errors at threshold', () => {
    const classification = { type: ErrorType.RETRYABLE, retryable: true, reason: 'Test' };
    expect(shouldMoveToDLQ(3, classification)).toBe(true);
  });
});

describe('getRetryDelay', () => {
  it('returns delay for retryable errors', () => {
    const error = { statusCode: 500 };
    const delay = getRetryDelay(1, error);
    expect(delay).toBeGreaterThan(0);
  });

  it('returns null for terminal errors', () => {
    const error = { statusCode: 400 };
    const delay = getRetryDelay(1, error);
    expect(delay).toBeNull();
  });

  it('increases delay with attempt number', () => {
    const error = { statusCode: 500 };
    const delay1 = getRetryDelay(1, error);
    const delay2 = getRetryDelay(2, error);
    expect(delay1).not.toBeNull();
    expect(delay2).not.toBeNull();
    if (delay1 !== null && delay2 !== null) {
      expect(delay2).toBeGreaterThan(delay1);
    }
  });
});

describe('formatError', () => {
  it('formats error with classification', () => {
    const error = new Error('Test error');
    error.stack = 'Error: Test error\n    at test.js:1:1';
    const classification = { type: ErrorType.RETRYABLE, retryable: true, reason: 'Server error' };
    const formatted = formatError(error, classification);

    expect(formatted.message).toBe('Test error');
    expect(formatted.type).toBe(ErrorType.RETRYABLE);
    expect(formatted.retryable).toBe(true);
    expect(formatted.reason).toBe('Server error');
    expect(formatted.stack).toBeDefined();
  });

  it('extracts statusCode from error', () => {
    const error = { statusCode: 500, message: 'Server error' };
    const classification = { type: ErrorType.RETRYABLE, retryable: true, reason: 'Test' };
    const formatted = formatError(error, classification);
    expect(formatted.statusCode).toBe(500);
  });

  it('extracts numeric code as statusCode', () => {
    const error = { code: 503, message: 'Service unavailable' };
    const classification = { type: ErrorType.RETRYABLE, retryable: true, reason: 'Test' };
    const formatted = formatError(error, classification);
    expect(formatted.statusCode).toBe(503);
  });

  it('preserves string code', () => {
    const error = { code: 'ETIMEDOUT', message: 'Timeout' };
    const classification = { type: ErrorType.RETRYABLE, retryable: true, reason: 'Test' };
    const formatted = formatError(error, classification);
    expect(formatted.code).toBe('ETIMEDOUT');
  });

  it('truncates long stack traces', () => {
    const error = new Error('Test');
    error.stack = 'a'.repeat(1000);
    const classification = { type: ErrorType.RETRYABLE, retryable: true, reason: 'Test' };
    const formatted = formatError(error, classification);
    expect(formatted.stack?.length).toBeLessThanOrEqual(500);
  });

  it('handles errors without stack', () => {
    const error = { message: 'Test error' };
    const classification = { type: ErrorType.RETRYABLE, retryable: true, reason: 'Test' };
    const formatted = formatError(error, classification);
    expect(formatted.stack).toBeUndefined();
  });
});
