// @ts-check
import { describe, it, expect } from 'vitest';
import {
  extractTextContent,
  extractTitleFromUrl,
  parseHtml,
  formatFetchResult,
} from './content-fetcher-html.js';

describe('content-fetcher-html', () => {
  describe('extractTextContent', () => {
    it('removes script tags and their content', () => {
      const html = '<p>Hello</p><script>alert("test")</script><p>World</p>';
      const result = extractTextContent(html);
      expect(result).toBe('Hello World');
      expect(result).not.toContain('alert');
    });

    it('removes style tags and their content', () => {
      const html = '<p>Hello</p><style>.test { color: red; }</style><p>World</p>';
      const result = extractTextContent(html);
      expect(result).toBe('Hello World');
      expect(result).not.toContain('color');
    });

    it('strips HTML tags', () => {
      const html = '<div><p>Hello <strong>World</strong></p></div>';
      const result = extractTextContent(html);
      expect(result).toBe('Hello World');
    });

    it('normalizes whitespace', () => {
      const html = '<p>Hello    World</p>\n\n<p>Test</p>';
      const result = extractTextContent(html);
      expect(result).toBe('Hello World Test');
    });

    it('respects maxLength parameter', () => {
      const html = '<p>This is a very long text that should be truncated</p>';
      const result = extractTextContent(html, 10);
      expect(result.length).toBeLessThanOrEqual(10);
    });

    it('handles empty HTML', () => {
      const result = extractTextContent('');
      expect(result).toBe('');
    });

    it('handles nested script tags', () => {
      const html = '<div><script type="text/javascript">var x = 1;</script><p>Content</p></div>';
      const result = extractTextContent(html);
      expect(result).toBe('Content');
    });

    it('handles case-insensitive tags', () => {
      const html = '<P>Hello</P><SCRIPT>test</SCRIPT><p>World</p>';
      const result = extractTextContent(html);
      expect(result).toBe('Hello World');
    });
  });

  describe('extractTitleFromUrl', () => {
    it('extracts title from URL path', () => {
      const url = 'https://example.com/blog/my-article-title';
      const result = extractTitleFromUrl(url);
      expect(result).toBe('my article title');
    });

    it('handles underscores in path', () => {
      const url = 'https://example.com/posts/my_blog_post';
      const result = extractTitleFromUrl(url);
      expect(result).toBe('my blog post');
    });

    it('removes file extension', () => {
      const url = 'https://example.com/documents/report.pdf';
      const result = extractTitleFromUrl(url);
      expect(result).toBe('report');
    });

    it('returns Untitled for invalid URLs', () => {
      const result = extractTitleFromUrl('not-a-valid-url');
      expect(result).toBe('Untitled');
    });

    it('handles root path', () => {
      const url = 'https://example.com/';
      const result = extractTitleFromUrl(url);
      expect(result).toBe('');
    });

    it('handles URLs with query parameters', () => {
      const url = 'https://example.com/article-name?param=value';
      const result = extractTitleFromUrl(url);
      expect(result).toBe('article name');
    });
  });

  describe('parseHtml', () => {
    it('extracts title from title tag', () => {
      const html = '<html><head><title>My Page Title</title></head><body></body></html>';
      const result = parseHtml(html, 'https://example.com');
      expect(result.title).toBe('My Page Title');
    });

    it('extracts title from og:title meta tag', () => {
      const html = '<html><head><meta property="og:title" content="OG Title"></head></html>';
      const result = parseHtml(html, 'https://example.com');
      expect(result.title).toBe('OG Title');
    });

    it('extracts title from h1 tag as fallback', () => {
      const html = '<html><body><h1>H1 Title</h1></body></html>';
      const result = parseHtml(html, 'https://example.com');
      expect(result.title).toBe('H1 Title');
    });

    it('falls back to URL-based title', () => {
      const html = '<html><body><p>No title here</p></body></html>';
      const result = parseHtml(html, 'https://example.com/my-article');
      expect(result.title).toBe('my article');
    });

    it('extracts description from meta tag', () => {
      const html = '<meta name="description" content="Page description">';
      const result = parseHtml(html, 'https://example.com');
      expect(result.description).toBe('Page description');
    });

    it('extracts description from og:description', () => {
      const html = '<meta property="og:description" content="OG Description">';
      const result = parseHtml(html, 'https://example.com');
      expect(result.description).toBe('OG Description');
    });

    it('returns empty description if not found', () => {
      const html = '<html><body></body></html>';
      const result = parseHtml(html, 'https://example.com');
      expect(result.description).toBe('');
    });

    it('extracts date from article:published_time', () => {
      const html = '<meta property="article:published_time" content="2024-01-15T10:00:00Z">';
      const result = parseHtml(html, 'https://example.com');
      expect(result.date).toBe('2024-01-15T10:00:00Z');
    });

    it('extracts date from time element', () => {
      const html = '<time datetime="2024-01-15">January 15, 2024</time>';
      const result = parseHtml(html, 'https://example.com');
      expect(result.date).toBe('2024-01-15');
    });

    it('returns null date if not found', () => {
      const html = '<html><body></body></html>';
      const result = parseHtml(html, 'https://example.com');
      expect(result.date).toBeNull();
    });

    it('extracts text content', () => {
      const html = '<html><body><p>Hello World</p></body></html>';
      const result = parseHtml(html, 'https://example.com');
      expect(result.textContent).toContain('Hello World');
    });
  });

  describe('formatFetchResult', () => {
    it('returns parsed result when parseResult is true', () => {
      const html = '<title>Test</title><p>Content</p>';
      const result = formatFetchResult(html, 'https://example.com', true);
      expect(result.title).toBe('Test');
      expect(result.textContent).toBeDefined();
    });

    it('returns raw HTML when parseResult is false', () => {
      const html = '<title>Test</title>';
      const result = formatFetchResult(html, 'https://example.com', false);
      expect(result.html).toBe(html);
      expect(result.title).toBeUndefined();
    });
  });
});
