import { describe, it, expect } from 'vitest';
import { expandItemThumb, findLocalThumbs, buildImageCandidates } from '../../lib/media';

describe('lib/media', () => {
  describe('expandItemThumb', () => {
    it('returns empty array for undefined', () => {
      expect(expandItemThumb(undefined)).toEqual([]);
    });

    it('returns image path as-is when has extension', () => {
      expect(expandItemThumb('/path/to/image.webp')).toEqual(['/path/to/image.webp']);
      expect(expandItemThumb('/path/to/image.png')).toEqual(['/path/to/image.png']);
      expect(expandItemThumb('/path/to/image.jpg')).toEqual(['/path/to/image.jpg']);
      expect(expandItemThumb('/path/to/image.jpeg')).toEqual(['/path/to/image.jpeg']);
    });

    it('returns http URL as-is without appending extensions', () => {
      expect(expandItemThumb('https://example.com/image')).toEqual(['https://example.com/image']);
      expect(expandItemThumb('http://example.com/image')).toEqual(['http://example.com/image']);
    });

    it('expands local slug to multiple extensions', () => {
      expect(expandItemThumb('my-slug')).toEqual(['my-slug.webp', 'my-slug.png', 'my-slug.jpg']);
    });
  });

  describe('findLocalThumbs', () => {
    it('returns empty array (local guessing disabled)', () => {
      expect(findLocalThumbs('any-slug')).toEqual([]);
      expect(findLocalThumbs(undefined)).toEqual([]);
    });
  });

  describe('buildImageCandidates', () => {
    it('returns empty array when no inputs', () => {
      expect(buildImageCandidates({})).toEqual([]);
    });

    it('returns thumbnail variants when provided', () => {
      expect(buildImageCandidates({ thumbnail: 'thumb-slug' })).toEqual([
        'thumb-slug.webp',
        'thumb-slug.png',
        'thumb-slug.jpg',
      ]);
    });

    it('returns direct image URL when thumbnail is URL', () => {
      expect(buildImageCandidates({ thumbnail: 'https://example.com/img.png' })).toEqual([
        'https://example.com/img.png',
      ]);
    });

    it('deduplicates results', () => {
      const result = buildImageCandidates({ slug: 'test', thumbnail: 'test' });
      // findLocalThumbs returns [], so only thumbnail variants
      expect(result).toEqual(['test.webp', 'test.png', 'test.jpg']);
    });
  });
});
