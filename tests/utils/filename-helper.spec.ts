import { describe, it, expect } from 'vitest';
import { toAscii, slug, lastName, kbFileName } from '../../scripts/lib/filename-helper.mjs';

describe('toAscii', () => {
  it('removes diacritics', () => {
    expect(toAscii('café')).toBe('cafe');
    expect(toAscii('naïve')).toBe('naive');
    expect(toAscii('Müller')).toBe('Muller');
  });

  it('handles empty/null input', () => {
    expect(toAscii('')).toBe('');
    expect(toAscii(null)).toBe('');
    expect(toAscii(undefined)).toBe('');
  });
});

describe('slug', () => {
  it('converts to lowercase', () => {
    expect(slug('Hello World')).toBe('hello-world');
  });

  it('replaces & with and', () => {
    expect(slug('AI & ML')).toBe('ai-and-ml');
  });

  it('replaces special characters with hyphens', () => {
    expect(slug('Hello, World!')).toBe('hello-world');
  });

  it('removes leading/trailing hyphens', () => {
    expect(slug('  Hello  ')).toBe('hello');
  });

  it('collapses multiple hyphens', () => {
    expect(slug('Hello---World')).toBe('hello-world');
  });

  it('handles empty input', () => {
    expect(slug('')).toBe('');
    expect(slug(null)).toBe('');
  });
});

describe('lastName', () => {
  it('extracts simple last name', () => {
    expect(lastName('John Doe')).toBe('doe');
  });

  it('handles Dutch particles (van, van der)', () => {
    expect(lastName('Jan van der Berg')).toBe('van-der-berg');
  });

  it('handles German particles (von)', () => {
    expect(lastName('Ludwig von Beethoven')).toBe('von-beethoven');
  });

  it('handles single name', () => {
    expect(lastName('Madonna')).toBe('madonna');
  });

  it('returns unknown for empty input', () => {
    expect(lastName('')).toBe('unknown');
    expect(lastName(null)).toBe('unknown');
  });
});

describe('kbFileName', () => {
  it('generates standard filename', () => {
    const result = kbFileName({
      title: 'AI in Banking',
      date_published: '2024-03-15',
      authors: ['John Doe'],
      source_name: 'TechNews',
    });
    expect(result).toBe('2024_ai-in-banking_doe-technews.json');
  });

  it('handles missing author', () => {
    const result = kbFileName({
      title: 'Test Article',
      date_published: '2024-01-01',
      source_name: 'Source',
    });
    expect(result).toContain('_unknown-');
  });

  it('handles version suffix', () => {
    const result = kbFileName({
      title: 'Test',
      date_published: '2024-01-01',
      authors: ['Author'],
      source_name: 'Source',
      version: '2',
    });
    expect(result).toContain('_v2.json');
  });

  it('uses source_domain when source_name missing', () => {
    const result = kbFileName({
      title: 'Test',
      date_published: '2024-01-01',
      authors: ['Author'],
      source_domain: 'www.example.com',
    });
    expect(result).toContain('-example.json');
  });
});
