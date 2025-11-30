import { describe, it, expect } from 'vitest';
import { linkify } from '../../src/lib/text';

describe('linkify', () => {
  it('converts URL to anchor tag', () => {
    const result = linkify('Check https://example.com for info');
    expect(result).toContain('<a href="https://example.com"');
    expect(result).toContain('target="_blank"');
    expect(result).toContain('rel="noopener"');
  });

  it('handles multiple URLs', () => {
    const result = linkify('Visit https://a.com and https://b.com');
    expect(result).toContain('href="https://a.com"');
    expect(result).toContain('href="https://b.com"');
  });

  it('handles URLs with paths and query params', () => {
    const result = linkify('Link: https://example.com/path?q=test#anchor');
    expect(result).toContain('href="https://example.com/path?q=test#anchor"');
  });

  it('escapes HTML in URLs', () => {
    const result = linkify('Bad: https://example.com/<script>');
    expect(result).toContain('&lt;script&gt;');
    expect(result).not.toContain('<script>');
  });

  it('returns empty string for undefined', () => {
    expect(linkify(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(linkify('')).toBe('');
  });

  it('returns text unchanged if no URLs', () => {
    expect(linkify('No links here')).toBe('No links here');
  });
});
