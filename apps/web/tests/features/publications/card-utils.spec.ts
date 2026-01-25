import { describe, it, expect } from 'vitest';
import {
  formatDate,
  asArray,
  stripSourceFromTitle,
  expandItemThumb,
  getDeepestTags,
  isWithinDays,
  calculateExtraTagCount,
  buildThumbnailUrl,
} from '../../../features/publications/card-utils';

describe('card-utils', () => {
  describe('formatDate', () => {
    it('formats ISO date to readable format', () => {
      const result = formatDate('2024-03-15T10:00:00Z');
      expect(result).toContain('Mar');
      expect(result).toContain('2024');
    });

    it('returns empty string for undefined', () => {
      expect(formatDate(undefined)).toBe('');
    });
  });

  describe('asArray', () => {
    it('returns array as-is', () => {
      expect(asArray([1, 2])).toEqual([1, 2]);
    });

    it('wraps single value in array', () => {
      expect(asArray('foo')).toEqual(['foo']);
    });

    it('returns empty array for falsy values', () => {
      expect(asArray(null)).toEqual([]);
      expect(asArray(undefined)).toEqual([]);
    });
  });

  describe('stripSourceFromTitle', () => {
    it('strips source suffix with pipe separator', () => {
      expect(stripSourceFromTitle('Article Title | Source Name', 'Source Name')).toBe(
        'Article Title',
      );
    });

    it('strips source suffix with dash separator', () => {
      expect(stripSourceFromTitle('Article Title - Source Name', 'Source Name')).toBe(
        'Article Title',
      );
    });

    it('strips source suffix without space after separator', () => {
      expect(stripSourceFromTitle('Article Title|Source Name', 'Source Name')).toBe(
        'Article Title',
      );
    });

    it('returns title unchanged when no source match', () => {
      expect(stripSourceFromTitle('Article Title', 'Other Source')).toBe('Article Title');
    });

    it('returns title unchanged when sourceName is null', () => {
      expect(stripSourceFromTitle('Article Title', null)).toBe('Article Title');
    });
  });

  describe('expandItemThumb', () => {
    it('returns empty array for undefined', () => {
      expect(expandItemThumb(undefined)).toEqual([]);
    });

    it('returns image path as-is when has extension', () => {
      expect(expandItemThumb('/path/to/image.webp')).toEqual(['/path/to/image.webp']);
      expect(expandItemThumb('/path/to/image.png')).toEqual(['/path/to/image.png']);
      expect(expandItemThumb('/path/to/image.jpg')).toEqual(['/path/to/image.jpg']);
    });

    it('returns http URL as-is', () => {
      expect(expandItemThumb('https://example.com/image')).toEqual(['https://example.com/image']);
    });

    it('expands slug to multiple extensions', () => {
      expect(expandItemThumb('my-slug')).toEqual(['my-slug.webp', 'my-slug.png', 'my-slug.jpg']);
    });
  });

  describe('getDeepestTags', () => {
    it('returns empty array for empty input', () => {
      expect(getDeepestTags([])).toEqual([]);
    });

    it('filters out parent tags when children exist', () => {
      expect(getDeepestTags(['banking', 'banking-retail', 'insurance'])).toEqual([
        'banking-retail',
        'insurance',
      ]);
    });

    it('returns all tags when no hierarchy', () => {
      expect(getDeepestTags(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
    });
  });

  describe('isWithinDays', () => {
    it('returns false for null/undefined', () => {
      expect(isWithinDays(null, 7)).toBe(false);
      expect(isWithinDays(undefined, 7)).toBe(false);
    });

    it('returns true for recent date', () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString();
      expect(isWithinDays(yesterday, 7)).toBe(true);
    });

    it('returns false for old date', () => {
      const oldDate = new Date(Date.now() - 86400000 * 30).toISOString();
      expect(isWithinDays(oldDate, 7)).toBe(false);
    });
  });

  describe('calculateExtraTagCount', () => {
    it('calculates extra tag count correctly', () => {
      const tags = {
        audiences: ['a', 'b'],
        deepestGeographies: ['g1', 'g2', 'g3'],
        deepestIndustries: ['i1'],
        topics: ['t1', 't2'],
        contentTypes: ['c1'],
        regulators: [],
        regulations: ['r1'],
        obligations: [],
        deepestProcesses: ['p1'],
      };
      // (2-1) + (3-1) + 1 + 2 + 1 + 0 + 1 + 0 + 1 = 1 + 2 + 1 + 2 + 1 + 1 + 1 = 9
      expect(calculateExtraTagCount(tags)).toBe(9);
    });
  });

  describe('buildThumbnailUrl', () => {
    it('returns null when missing required params', () => {
      expect(buildThumbnailUrl(null, 'bucket', 'https://supabase.co')).toBeNull();
      expect(buildThumbnailUrl('path', null, 'https://supabase.co')).toBeNull();
      expect(buildThumbnailUrl('path', 'bucket', undefined)).toBeNull();
    });

    it('builds correct URL when all params provided', () => {
      expect(buildThumbnailUrl('path/to/img.webp', 'thumbnails', 'https://supabase.co')).toBe(
        'https://supabase.co/storage/v1/object/public/thumbnails/path/to/img.webp',
      );
    });
  });
});
