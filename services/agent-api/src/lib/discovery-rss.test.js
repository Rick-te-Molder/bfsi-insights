// @ts-check
import { describe, it, expect } from 'vitest';
import { parseRSS, extractDate } from './discovery-rss.js';

describe('discovery-rss', () => {
  describe('extractDate', () => {
    it('parses valid RSS date string', () => {
      const result = extractDate('Mon, 15 Jan 2024 12:00:00 GMT', 'https://example.com', 'Test');
      expect(result).toBe('2024-01-15T12:00:00.000Z');
    });

    it('parses ISO date string', () => {
      const result = extractDate('2024-01-15T10:30:00Z', 'https://example.com', 'Test');
      expect(result).toBe('2024-01-15T10:30:00.000Z');
    });

    it('returns null for invalid date string', () => {
      const result = extractDate('not a date', 'https://example.com', 'Test');
      expect(result).toBeNull();
    });

    it('returns null when no date string provided', () => {
      const result = extractDate(null, 'https://example.com', 'Test');
      expect(result).toBeNull();
    });

    it('extracts date from arXiv URL when RSS date is missing', () => {
      const result = extractDate(null, 'https://arxiv.org/abs/2401.12345', 'arXiv');
      // Date is constructed as local timezone, so just check it's a valid ISO date in roughly the right period
      expect(result).not.toBeNull();
      expect(new Date(result).getFullYear()).toBe(2024);
    });

    it('extracts date from arXiv PDF URL', () => {
      const result = extractDate(null, 'https://arxiv.org/pdf/2312.54321', 'Test');
      expect(result).not.toBeNull();
      expect(new Date(result).getFullYear()).toBe(2023);
    });

    it('returns null for arXiv URL with invalid year', () => {
      const result = extractDate(null, 'https://arxiv.org/abs/1501.12345', 'arXiv');
      expect(result).toBeNull();
    });

    it('returns null for arXiv URL with invalid month', () => {
      const result = extractDate(null, 'https://arxiv.org/abs/2413.12345', 'arXiv');
      expect(result).toBeNull();
    });

    it('returns null for non-arXiv URL without RSS date', () => {
      const result = extractDate(null, 'https://example.com/article', 'Test');
      expect(result).toBeNull();
    });
  });

  describe('parseRSS', () => {
    const defaultConfig = {
      keywords: ['finance', 'banking', 'insurance'],
      exclusionPatterns: [/podcast/i, /video/i],
    };

    const defaultSource = {
      name: 'Test Source',
      tier: 'standard',
      category: 'news',
    };

    it('parses valid RSS items', () => {
      const xml = `
        <rss>
          <channel>
            <item>
              <title>Banking News Today</title>
              <link>https://example.com/banking-news</link>
              <pubDate>Mon, 15 Jan 2024 12:00:00 GMT</pubDate>
              <description>Latest banking updates</description>
            </item>
          </channel>
        </rss>
      `;

      const result = parseRSS(xml, defaultSource, defaultConfig);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Banking News Today');
      expect(result[0].url).toBe('https://example.com/banking-news');
      expect(result[0].published_at).toBe('2024-01-15T12:00:00.000Z');
    });

    it('parses Atom feed entries', () => {
      const xml = `
        <feed>
          <entry>
            <title>Insurance Report</title>
            <link href="https://example.com/insurance-report"/>
            <published>2024-01-15T10:00:00Z</published>
            <summary>Insurance industry analysis</summary>
          </entry>
        </feed>
      `;

      const result = parseRSS(xml, defaultSource, defaultConfig);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Insurance Report');
    });

    it('filters out items without BFSI keywords', () => {
      const xml = `
        <rss>
          <channel>
            <item>
              <title>Sports News</title>
              <link>https://example.com/sports</link>
              <description>Football updates</description>
            </item>
          </channel>
        </rss>
      `;

      const result = parseRSS(xml, defaultSource, defaultConfig);

      expect(result).toHaveLength(0);
    });

    it('filters out items matching exclusion patterns', () => {
      const xml = `
        <rss>
          <channel>
            <item>
              <title>Banking Podcast Episode 5</title>
              <link>https://example.com/banking-podcast</link>
              <description>Finance discussion</description>
            </item>
          </channel>
        </rss>
      `;

      const result = parseRSS(xml, defaultSource, defaultConfig);

      expect(result).toHaveLength(0);
    });

    it('skips keyword filter for premium regulator sources', () => {
      const premiumSource = {
        name: 'ECB',
        tier: 'premium',
        category: 'regulator',
      };

      const xml = `
        <rss>
          <channel>
            <item>
              <title>ECB Policy Update</title>
              <link>https://ecb.europa.eu/press</link>
              <description>Monetary policy announcement</description>
            </item>
          </channel>
        </rss>
      `;

      const result = parseRSS(xml, premiumSource, defaultConfig);

      expect(result).toHaveLength(1);
    });

    it('handles CDATA in title and description', () => {
      const xml = `
        <rss>
          <channel>
            <item>
              <title><![CDATA[Finance & Banking News]]></title>
              <link>https://example.com/news</link>
              <description><![CDATA[Latest <strong>finance</strong> updates]]></description>
            </item>
          </channel>
        </rss>
      `;

      const result = parseRSS(xml, defaultSource, defaultConfig);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Finance & Banking News');
    });

    it('skips items without valid URL', () => {
      const xml = `
        <rss>
          <channel>
            <item>
              <title>Banking News</title>
              <link>not-a-valid-url</link>
            </item>
          </channel>
        </rss>
      `;

      const result = parseRSS(xml, defaultSource, defaultConfig);

      expect(result).toHaveLength(0);
    });

    it('skips items without title', () => {
      const xml = `
        <rss>
          <channel>
            <item>
              <link>https://example.com/banking</link>
              <description>Banking finance news</description>
            </item>
          </channel>
        </rss>
      `;

      const result = parseRSS(xml, defaultSource, defaultConfig);

      expect(result).toHaveLength(0);
    });

    it('truncates long descriptions to 500 chars', () => {
      const longDesc = 'a'.repeat(600) + ' finance';
      const xml = `
        <rss>
          <channel>
            <item>
              <title>Banking Article</title>
              <link>https://example.com/article</link>
              <description>${longDesc}</description>
            </item>
          </channel>
        </rss>
      `;

      const result = parseRSS(xml, defaultSource, defaultConfig);

      expect(result).toHaveLength(1);
      expect(result[0].description.length).toBeLessThanOrEqual(500);
    });

    it('parses multiple items', () => {
      const xml = `
        <rss>
          <channel>
            <item>
              <title>Banking News 1</title>
              <link>https://example.com/1</link>
            </item>
            <item>
              <title>Insurance Update</title>
              <link>https://example.com/2</link>
            </item>
            <item>
              <title>Finance Report</title>
              <link>https://example.com/3</link>
            </item>
          </channel>
        </rss>
      `;

      const result = parseRSS(xml, defaultSource, defaultConfig);

      expect(result).toHaveLength(3);
    });
  });
});
