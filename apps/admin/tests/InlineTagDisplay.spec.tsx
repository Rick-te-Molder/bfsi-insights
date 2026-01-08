import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InlineTagDisplay } from '@/components/tags/InlineTagDisplay';
import type { TaxonomyConfig } from '@/components/tags/types';

describe('InlineTagDisplay', () => {
  const mockTaxonomyData = {
    industry: [
      { code: 'banking', name: 'Banking' },
      { code: 'insurance', name: 'Insurance' },
    ],
    geography: [
      { code: 'usa', name: 'United States' },
      { code: 'global', name: 'Global' },
    ],
  };

  const mockConfigs: TaxonomyConfig[] = [
    {
      slug: 'industry',
      payload_field: 'industry_codes',
      behavior_type: 'guardrail',
      color: 'blue',
      display_order: 1,
      display_name: 'Industry',
      source_table: 'industry',
      score_parent_slug: null,
      score_threshold: null,
    },
    {
      slug: 'geography',
      payload_field: 'geography_codes',
      behavior_type: 'guardrail',
      color: 'emerald',
      display_order: 2,
      display_name: 'Geography',
      source_table: 'geography',
      score_parent_slug: null,
      score_threshold: null,
    },
  ];

  it('renders audience tags', () => {
    const html = renderToStaticMarkup(
      <InlineTagDisplay
        payload={{}}
        taxonomyData={mockTaxonomyData}
        topAudiences={[
          { slug: 'executive', name: 'Executive', score: 8 },
          { slug: 'engineer', name: 'Engineer', score: 7 },
        ]}
        sortedNonAudienceConfigs={[]}
      />,
    );

    expect(html).toContain('Executive');
    expect(html).toContain('Engineer');
  });

  it('renders industry tags from payload', () => {
    const html = renderToStaticMarkup(
      <InlineTagDisplay
        payload={{ industry_codes: ['banking', 'insurance'] }}
        taxonomyData={mockTaxonomyData}
        topAudiences={[]}
        sortedNonAudienceConfigs={mockConfigs}
      />,
    );

    expect(html).toContain('Banking');
    expect(html).toContain('Insurance');
  });

  it('uses code when name not in taxonomy', () => {
    const html = renderToStaticMarkup(
      <InlineTagDisplay
        payload={{ industry_codes: ['fintech'] }}
        taxonomyData={mockTaxonomyData}
        topAudiences={[]}
        sortedNonAudienceConfigs={mockConfigs}
      />,
    );

    expect(html).toContain('fintech');
  });

  it('defaults to global for empty geography', () => {
    const html = renderToStaticMarkup(
      <InlineTagDisplay
        payload={{ geography_codes: [] }}
        taxonomyData={mockTaxonomyData}
        topAudiences={[]}
        sortedNonAudienceConfigs={mockConfigs}
      />,
    );

    expect(html).toContain('Global');
  });

  it('filters out scoring behavior type configs', () => {
    const configsWithScoring: TaxonomyConfig[] = [
      ...mockConfigs,
      {
        slug: 'relevance',
        payload_field: 'relevance_score',
        behavior_type: 'scoring',
        color: 'red',
        display_order: 3,
        display_name: 'Relevance',
        source_table: 'relevance',
        score_parent_slug: null,
        score_threshold: null,
      },
    ];

    const html = renderToStaticMarkup(
      <InlineTagDisplay
        payload={{ relevance_score: 8 }}
        taxonomyData={{}}
        topAudiences={[]}
        sortedNonAudienceConfigs={configsWithScoring}
      />,
    );

    // Scoring types should not render
    expect(html).not.toContain('relevance');
  });

  it('limits codes to 2 per config', () => {
    const html = renderToStaticMarkup(
      <InlineTagDisplay
        payload={{ industry_codes: ['a', 'b', 'c', 'd'] }}
        taxonomyData={{}}
        topAudiences={[]}
        sortedNonAudienceConfigs={mockConfigs}
      />,
    );

    // Only first 2 should be shown
    expect(html).toContain('>a<');
    expect(html).toContain('>b<');
    expect(html).not.toContain('>c<');
    expect(html).not.toContain('>d<');
  });

  it('applies violet color to audience tags', () => {
    const html = renderToStaticMarkup(
      <InlineTagDisplay
        payload={{}}
        taxonomyData={{}}
        topAudiences={[{ slug: 'exec', name: 'Executive', score: 9 }]}
        sortedNonAudienceConfigs={[]}
      />,
    );

    expect(html).toContain('bg-violet');
    expect(html).toContain('text-violet');
  });

  it('renders with empty props', () => {
    const html = renderToStaticMarkup(
      <InlineTagDisplay
        payload={{}}
        taxonomyData={{}}
        topAudiences={[]}
        sortedNonAudienceConfigs={[]}
      />,
    );

    expect(html).toContain('flex');
  });
});
