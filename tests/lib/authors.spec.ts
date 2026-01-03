import { describe, it, expect } from 'vitest';
import { normalizeAuthors } from '../../site/lib/authors';

describe('normalizeAuthors', () => {
  it('returns empty array for null', () => {
    expect(normalizeAuthors(null)).toEqual([]);
  });

  it('returns empty array for undefined', () => {
    expect(normalizeAuthors(undefined)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(normalizeAuthors('')).toEqual([]);
  });

  it('parses comma-separated string', () => {
    expect(normalizeAuthors('John Doe, Jane Smith')).toEqual(['John Doe', 'Jane Smith']);
  });

  it('trims whitespace from names', () => {
    expect(normalizeAuthors('  John Doe ,  Jane Smith  ')).toEqual(['John Doe', 'Jane Smith']);
  });

  it('filters empty strings', () => {
    expect(normalizeAuthors('John Doe, , Jane Smith')).toEqual(['John Doe', 'Jane Smith']);
  });

  it('handles array input', () => {
    expect(normalizeAuthors(['John Doe', 'Jane Smith'])).toEqual(['John Doe', 'Jane Smith']);
  });

  it('converts array elements to strings', () => {
    expect(normalizeAuthors([123, 'Jane'])).toEqual(['123', 'Jane']);
  });

  it('returns empty array for object input', () => {
    expect(normalizeAuthors({ name: 'John' })).toEqual([]);
  });

  it('returns empty array for number input', () => {
    expect(normalizeAuthors(123)).toEqual([]);
  });
});
