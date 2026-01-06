// @ts-check
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./tagger-config.js', () => ({
  getGeographyFromTld: vi.fn(() => Promise.resolve(null)),
}));

import {
  extractTld,
  buildCountryTldHint,
  buildContextData,
  buildSystemPrompt,
  buildUserContent,
  logPromptDebug,
  logTopicDebug,
} from './tagger-prompt.js';
import { getGeographyFromTld } from './tagger-config.js';

describe('tagger-prompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('extractTld', () => {
    it('extracts TLD from URL', () => {
      expect(extractTld('https://example.com/page')).toBe('com');
    });

    it('extracts country TLD', () => {
      expect(extractTld('https://example.nl/page')).toBe('nl');
    });

    it('handles URL with path', () => {
      expect(extractTld('https://example.co.uk/path/to/page')).toBe('uk');
    });

    it('returns empty string for null URL', () => {
      expect(extractTld(null)).toBe('');
    });

    it('returns empty string for undefined URL', () => {
      expect(extractTld(undefined)).toBe('');
    });

    it('returns empty string for empty URL', () => {
      expect(extractTld('')).toBe('');
    });
  });

  describe('buildCountryTldHint', () => {
    it('returns empty string when no geography match', async () => {
      vi.mocked(getGeographyFromTld).mockResolvedValue(null);

      const result = await buildCountryTldHint('https://example.com/page');

      expect(result).toBe('');
    });

    it('returns hint when geography matches TLD', async () => {
      vi.mocked(getGeographyFromTld).mockResolvedValue({
        code: 'nl',
        name: 'Netherlands',
      });

      const result = await buildCountryTldHint('https://example.nl/page');

      expect(result).toContain('.nl');
      expect(result).toContain('NL');
      expect(result).toContain('Netherlands');
    });
  });

  describe('buildContextData', () => {
    it('builds context with all fields', () => {
      const payload = {
        title: 'Test Article',
        summary: { short: 'Summary text' },
        url: 'https://example.com',
      };
      const taxonomies = {
        industries: 'banking, insurance',
        topics: 'AI, ML',
        geographies: 'NL, EU',
        useCases: 'fraud detection',
        capabilities: 'automation',
        regulators: 'ECB',
        regulations: 'GDPR',
        obligations: 'reporting',
        processes: 'kyc',
      };
      const vendorData = { formatted: 'Vendor1, Vendor2' };
      const countryTldHint = 'NOTE: .nl domain';

      const result = buildContextData(payload, taxonomies, vendorData, countryTldHint);

      expect(result.title).toBe('Test Article');
      expect(result.summary).toBe('Summary text');
      expect(result.url).toBe('https://example.com');
      expect(result.countryTldHint).toBe('NOTE: .nl domain');
      expect(result.industries).toBe('banking, insurance');
      expect(result.vendors).toBe('Vendor1, Vendor2');
    });

    it('uses description fallback when summary missing', () => {
      const payload = {
        title: 'Test',
        description: 'Description text',
      };
      const taxonomies = {
        industries: '',
        topics: '',
        geographies: '',
        useCases: '',
        capabilities: '',
        regulators: '',
        regulations: '',
        obligations: '',
        processes: '',
      };

      const result = buildContextData(payload, taxonomies, { formatted: '' }, '');

      expect(result.summary).toBe('Description text');
    });
  });

  describe('buildSystemPrompt', () => {
    it('replaces placeholders with context data', () => {
      const template = 'Title: {{title}}, Summary: {{summary}}';
      const contextData = { title: 'My Title', summary: 'My Summary' };

      const result = buildSystemPrompt(template, contextData);

      expect(result).toBe('Title: My Title, Summary: My Summary');
    });

    it('replaces multiple occurrences of same placeholder', () => {
      const template = '{{title}} - {{title}}';
      const contextData = { title: 'Repeated' };

      const result = buildSystemPrompt(template, contextData);

      expect(result).toBe('Repeated - Repeated');
    });

    it('handles null values', () => {
      const template = 'Value: {{field}}';
      const contextData = { field: null };

      const result = buildSystemPrompt(template, contextData);

      expect(result).toBe('Value: ');
    });
  });

  describe('buildUserContent', () => {
    it('builds user content with all fields', () => {
      const payload = {
        title: 'Article Title',
        summary: { short: 'Short summary' },
        url: 'https://example.com/article',
      };

      const result = buildUserContent(payload);

      expect(result).toContain('TITLE: Article Title');
      expect(result).toContain('SUMMARY: Short summary');
      expect(result).toContain('URL: https://example.com/article');
    });

    it('uses description fallback when no summary', () => {
      const payload = {
        title: 'Title',
        description: 'Description fallback',
      };

      const result = buildUserContent(payload);

      expect(result).toContain('SUMMARY: Description fallback');
    });

    it('handles missing URL', () => {
      const payload = {
        title: 'Title',
        summary: { short: 'Summary' },
      };

      const result = buildUserContent(payload);

      expect(result).toContain('URL: ');
    });
  });

  describe('logPromptDebug', () => {
    it('logs debug info', () => {
      logPromptDebug('prompt with Kee Platforms', 'content', 'system prompt');

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[tagger]'));
    });

    it('handles null prompt template', () => {
      logPromptDebug(null, 'content', 'system');

      expect(console.log).toHaveBeenCalled();
    });
  });

  describe('logTopicDebug', () => {
    it('logs topic debug info', () => {
      const rawTopics = ['topic1', 'topic2'];
      const validatedTopics = ['topic1'];
      const validCodes = { topics: new Set(['topic1']) };

      logTopicDebug(rawTopics, validatedTopics, validCodes);

      expect(console.log).toHaveBeenCalled();
      expect(console.log.mock.calls.length).toBeGreaterThan(0);
    });
  });
});
