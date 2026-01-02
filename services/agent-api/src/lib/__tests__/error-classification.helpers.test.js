// @ts-check
import { describe, it, expect } from 'vitest';
import {
  parseError,
  isRateLimitError,
  isServerError,
  isTimeoutError,
  isNetworkError,
  isClientError,
  isAuthError,
  isValidationError,
} from '../error-classification.helpers.js';

describe('parseError', () => {
  it('parses standard Error object', () => {
    const error = new Error('Test error');
    const result = parseError(error);

    expect(result.message).toBe('test error');
    expect(result.statusCode).toBeUndefined();
    expect(result.errorCode).toBeUndefined();
  });

  it('extracts statusCode from error object', () => {
    const error = { statusCode: 500, message: 'Server error' };
    const result = parseError(error);

    expect(result.statusCode).toBe(500);
    expect(result.message).toBe('server error');
  });

  it('extracts numeric code as statusCode', () => {
    const error = { code: 503, message: 'Service unavailable' };
    const result = parseError(error);

    expect(result.statusCode).toBe(503);
    expect(result.errorCode).toBeUndefined();
  });

  it('extracts string code as errorCode', () => {
    const error = { code: 'ETIMEDOUT', message: 'Timeout' };
    const result = parseError(error);

    expect(result.errorCode).toBe('ETIMEDOUT');
    expect(result.statusCode).toBeUndefined();
  });

  it('prefers statusCode over numeric code', () => {
    const error = { statusCode: 500, code: 503, message: 'Error' };
    const result = parseError(error);

    expect(result.statusCode).toBe(500);
  });

  it('lowercases message', () => {
    const error = new Error('UPPERCASE ERROR');
    const result = parseError(error);

    expect(result.message).toBe('uppercase error');
  });

  it('handles null/undefined error', () => {
    const result = parseError(null);

    expect(result.message).toBe('null');
    expect(result.statusCode).toBeUndefined();
    expect(result.errorCode).toBeUndefined();
  });

  it('handles error without message', () => {
    const error = { statusCode: 500 };
    const result = parseError(error);

    expect(result.message).toBe('[object object]');
    expect(result.statusCode).toBe(500);
  });
});

describe('isRateLimitError', () => {
  it('detects 429 status code', () => {
    expect(isRateLimitError(429, '')).toBe(true);
  });

  it('detects rate limit in message', () => {
    expect(isRateLimitError(undefined, 'rate limit exceeded')).toBe(true);
  });

  it('detects too many requests in message', () => {
    expect(isRateLimitError(undefined, 'too many requests')).toBe(true);
  });

  it('returns false for non-rate-limit errors', () => {
    expect(isRateLimitError(500, 'server error')).toBe(false);
  });
});

describe('isServerError', () => {
  it('detects 500 status', () => {
    expect(isServerError(500)).toBe(true);
  });

  it('detects 503 status', () => {
    expect(isServerError(503)).toBe(true);
  });

  it('detects 599 status', () => {
    expect(isServerError(599)).toBe(true);
  });

  it('rejects 400 status', () => {
    expect(isServerError(400)).toBe(false);
  });

  it('rejects 600 status', () => {
    expect(isServerError(600)).toBe(false);
  });

  it('rejects undefined status', () => {
    expect(isServerError(undefined)).toBe(false);
  });
});

describe('isTimeoutError', () => {
  it('detects ETIMEDOUT code', () => {
    expect(isTimeoutError('ETIMEDOUT', '')).toBe(true);
  });

  it('detects ECONNRESET code', () => {
    expect(isTimeoutError('ECONNRESET', '')).toBe(true);
  });

  it('detects timeout in message', () => {
    expect(isTimeoutError(undefined, 'request timeout')).toBe(true);
  });

  it('detects etimedout in message (lowercase)', () => {
    expect(isTimeoutError(undefined, 'etimedout error')).toBe(true);
  });

  it('detects econnreset in message (lowercase)', () => {
    expect(isTimeoutError(undefined, 'econnreset error')).toBe(true);
  });

  it('returns false for non-timeout errors', () => {
    expect(isTimeoutError('ECONNREFUSED', 'connection refused')).toBe(false);
  });
});

describe('isNetworkError', () => {
  it('detects ECONNREFUSED code', () => {
    expect(isNetworkError('ECONNREFUSED', '')).toBe(true);
  });

  it('detects ENOTFOUND code', () => {
    expect(isNetworkError('ENOTFOUND', '')).toBe(true);
  });

  it('detects network in message', () => {
    expect(isNetworkError(undefined, 'network error')).toBe(true);
  });

  it('detects econnrefused in message (lowercase)', () => {
    expect(isNetworkError(undefined, 'econnrefused error')).toBe(true);
  });

  it('detects enotfound in message (lowercase)', () => {
    expect(isNetworkError(undefined, 'enotfound error')).toBe(true);
  });

  it('returns false for non-network errors', () => {
    expect(isNetworkError('ETIMEDOUT', 'timeout')).toBe(false);
  });
});

describe('isClientError', () => {
  it('detects 400 status', () => {
    expect(isClientError(400)).toBe(true);
  });

  it('detects 404 status', () => {
    expect(isClientError(404)).toBe(true);
  });

  it('detects 499 status', () => {
    expect(isClientError(499)).toBe(true);
  });

  it('excludes 429 (rate limit)', () => {
    expect(isClientError(429)).toBe(false);
  });

  it('rejects 500 status', () => {
    expect(isClientError(500)).toBe(false);
  });

  it('rejects 399 status', () => {
    expect(isClientError(399)).toBe(false);
  });

  it('rejects undefined status', () => {
    expect(isClientError(undefined)).toBe(false);
  });
});

describe('isAuthError', () => {
  it('detects unauthorized in message', () => {
    expect(isAuthError('unauthorized access')).toBe(true);
  });

  it('detects forbidden in message', () => {
    expect(isAuthError('forbidden resource')).toBe(true);
  });

  it('detects authentication in message', () => {
    expect(isAuthError('authentication failed')).toBe(true);
  });

  it('returns false for non-auth errors', () => {
    expect(isAuthError('server error')).toBe(false);
  });
});

describe('isValidationError', () => {
  it('detects validation in message', () => {
    expect(isValidationError('validation failed')).toBe(true);
  });

  it('detects invalid in message', () => {
    expect(isValidationError('invalid input')).toBe(true);
  });

  it('detects malformed in message', () => {
    expect(isValidationError('malformed request')).toBe(true);
  });

  it('returns false for non-validation errors', () => {
    expect(isValidationError('server error')).toBe(false);
  });
});
