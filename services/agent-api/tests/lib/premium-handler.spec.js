/**
 * Tests for premium-handler.js
 *
 * Focus:
 * - Premium source detection
 * - Headline extraction
 * - Payload building
 * - Candidate filtering
 *
 * KB-155: Agentic Discovery System - Phase 4
 */

import { describe, it, expect } from 'vitest';
import {
  isPremiumSource,
  getPremiumMode,
  getPremiumConfig,
  extractRssPreview,
  buildPremiumPayload,
  filterPremiumCandidates,
  PREMIUM_MODES,
} from '../../src/lib/premium-handler.js';

describe('isPremiumSource', () => {
  it('returns true for premium tier sources', () => {
    expect(isPremiumSource({ tier: 'premium' })).toBe(true);
  });

  it('returns false for standard tier sources', () => {
    expect(isPremiumSource({ tier: 'standard' })).toBe(false);
  });

  it('returns false for sources with no tier', () => {
    expect(isPremiumSource({})).toBe(false);
  });
});

describe('getPremiumMode', () => {
  it('returns headline_only for publication category', () => {
    const source = { tier: 'premium', category: 'publication' };
    expect(getPremiumMode(source)).toBe(PREMIUM_MODES.HEADLINE_ONLY);
  });

  it('returns landing_page for consultancy category', () => {
    const source = { tier: 'premium', category: 'consultancy' };
    expect(getPremiumMode(source)).toBe(PREMIUM_MODES.LANDING_PAGE);
  });

  it('returns headline_only as default', () => {
    const source = { tier: 'premium' };
    expect(getPremiumMode(source)).toBe(PREMIUM_MODES.HEADLINE_ONLY);
  });
});

describe('getPremiumConfig', () => {
  it('uses custom config when provided', () => {
    const source = {
      tier: 'premium',
      premium_config: { mode: 'manual_curation', custom: true },
    };
    const config = getPremiumConfig(source);
    expect(config.mode).toBe('manual_curation');
    expect(config.custom).toBe(true);
  });

  it('falls back to category default', () => {
    const source = { tier: 'premium', category: 'publication' };
    const config = getPremiumConfig(source);
    expect(config.mode).toBe(PREMIUM_MODES.HEADLINE_ONLY);
    expect(config.extractPreview).toBe(true);
  });
});

describe('extractRssPreview', () => {
  it('extracts clean preview from HTML description', () => {
    const description = '<p>This is a <strong>test</strong> article.</p>';
    const result = extractRssPreview(description);
    expect(result.preview).toBe('This is a test article.');
    expect(result.wordCount).toBe(5);
  });

  it('handles empty description', () => {
    const result = extractRssPreview(null);
    expect(result.preview).toBeNull();
    expect(result.wordCount).toBe(0);
  });

  it('truncates long descriptions', () => {
    const longText = 'word '.repeat(200);
    const result = extractRssPreview(longText);
    expect(result.preview.length).toBeLessThanOrEqual(503); // 500 + '...'
  });

  it('marks substantive previews', () => {
    const shortDesc = 'Short';
    const longDesc = 'A'.repeat(150);

    expect(extractRssPreview(shortDesc).hasSubstantivePreview).toBe(false);
    expect(extractRssPreview(longDesc).hasSubstantivePreview).toBe(true);
  });
});

describe('buildPremiumPayload', () => {
  const mockSource = {
    name: 'Financial Times',
    slug: 'ft',
    tier: 'premium',
    domain: 'ft.com',
    category: 'publication',
  };

  const mockCandidate = {
    title: 'Test Article',
    url: 'https://ft.com/article/123',
    description: 'Article summary',
    published_at: '2024-01-01',
  };

  it('builds complete payload with all fields', () => {
    const payload = buildPremiumPayload(mockCandidate, mockSource);

    expect(payload.title).toBe('Test Article');
    expect(payload.url).toBe('https://ft.com/article/123');
    expect(payload.source).toBe('Financial Times');
    expect(payload.source_slug).toBe('ft');
    expect(payload.premium).toBe(true);
    expect(payload.manual_review_required).toBe(true);
  });

  it('sets premium mode correctly', () => {
    const payload = buildPremiumPayload(mockCandidate, mockSource);
    expect(payload.premium_mode).toBe(PREMIUM_MODES.HEADLINE_ONLY);
  });

  it('includes preview data when available', () => {
    const payload = buildPremiumPayload(mockCandidate, mockSource);
    expect(payload.preview).toBe('Article summary');
  });
});

describe('filterPremiumCandidates', () => {
  it('filters out candidates without title', () => {
    const candidates = [
      { title: 'Valid Article Title', url: 'https://example.com' },
      { url: 'https://example.com/no-title' },
    ];
    const filtered = filterPremiumCandidates(candidates);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe('Valid Article Title');
  });

  it('filters out candidates without url', () => {
    const candidates = [
      { title: 'Valid Article Title', url: 'https://example.com' },
      { title: 'No URL Article' },
    ];
    const filtered = filterPremiumCandidates(candidates);
    expect(filtered).toHaveLength(1);
  });

  it('filters out short titles', () => {
    const candidates = [
      { title: 'Valid Title Here', url: 'https://example.com' },
      { title: 'Short', url: 'https://example.com/short' },
    ];
    const filtered = filterPremiumCandidates(candidates);
    expect(filtered).toHaveLength(1);
  });

  it('filters out navigation pages', () => {
    const candidates = [
      { title: 'Real Article Title', url: 'https://example.com/article' },
      { title: 'Home', url: 'https://example.com/' },
      { title: 'Subscribe', url: 'https://example.com/subscribe' },
      { title: 'Sign In', url: 'https://example.com/signin' },
    ];
    const filtered = filterPremiumCandidates(candidates);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe('Real Article Title');
  });
});

describe('PREMIUM_MODES', () => {
  it('exports all expected modes', () => {
    expect(PREMIUM_MODES.HEADLINE_ONLY).toBe('headline_only');
    expect(PREMIUM_MODES.LANDING_PAGE).toBe('landing_page');
    expect(PREMIUM_MODES.MANUAL_CURATION).toBe('manual_curation');
    expect(PREMIUM_MODES.SKIP).toBe('skip');
  });
});
