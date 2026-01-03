import { describe, it, expect } from 'vitest';
import { fmt, withLabel } from '../../lib/fmt';

describe('fmt', () => {
  it('formats ISO date to en-GB format', () => {
    expect(fmt('2024-03-15')).toBe('15 Mar 2024');
  });

  it('handles full ISO datetime', () => {
    expect(fmt('2024-12-25T10:30:00Z')).toBe('25 Dec 2024');
  });

  it('returns empty string for undefined', () => {
    expect(fmt(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(fmt('')).toBe('');
  });

  it('returns empty string for invalid date', () => {
    expect(fmt('not-a-date')).toBe('');
  });
});

describe('withLabel', () => {
  it('combines label and value', () => {
    expect(withLabel('By', 'John Doe')).toBe('By John Doe');
  });

  it('returns empty string when value is empty', () => {
    expect(withLabel('By', '')).toBe('');
  });

  it('returns empty string when value is undefined', () => {
    expect(withLabel('By', undefined)).toBe('');
  });
});
