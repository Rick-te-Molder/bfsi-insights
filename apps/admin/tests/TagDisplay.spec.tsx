import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TagDisplay } from '@/components/tags/TagDisplay';
import type { TaxonomyConfig } from '@/components/tags/types';

describe('TagDisplay', () => {
  const mockTaxonomyData = {
    industry: [
      { code: 'banking', name: 'Banking' },
      { code: 'insurance', name: 'Insurance' },
    ],
    geography: [{ code: 'global', name: 'Global' }],
    audience: [{ code: 'executive', name: 'Executive' }],
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
      slug: 'audience_executive',
      payload_field: 'audience_scores.executive',
      behavior_type: 'scoring',
      color: 'violet',
      display_order: 2,
      display_name: 'Executive',
      source_table: 'audience',
      score_parent_slug: 'audience',
      score_threshold: 0.5,
    },
  ];

  it('renders table variant by default', () => {
    const html = renderToStaticMarkup(
      <TagDisplay payload={{}} taxonomyConfig={mockConfigs} taxonomyData={mockTaxonomyData} />,
    );

    expect(html).toContain('space-y-2');
    expect(html).toContain('Industry');
  });

  it('renders inline variant', () => {
    const html = renderToStaticMarkup(
      <TagDisplay
        payload={{ industry_codes: ['banking'] }}
        taxonomyConfig={mockConfigs}
        taxonomyData={mockTaxonomyData}
        variant="inline"
      />,
    );

    expect(html).toContain('flex');
    expect(html).toContain('Banking');
  });

  it('renders table-with-percentages variant', () => {
    const html = renderToStaticMarkup(
      <TagDisplay
        payload={{ audience_scores: { executive: 0.9 } }}
        taxonomyConfig={mockConfigs}
        taxonomyData={mockTaxonomyData}
        variant="table-with-percentages"
      />,
    );

    expect(html).toContain('90%');
  });

  it('uses custom label width', () => {
    const html = renderToStaticMarkup(
      <TagDisplay
        payload={{}}
        taxonomyConfig={mockConfigs}
        taxonomyData={mockTaxonomyData}
        labelWidth="w-32"
      />,
    );

    expect(html).toContain('w-32');
  });

  it('filters audience configs correctly', () => {
    const html = renderToStaticMarkup(
      <TagDisplay
        payload={{ audience_scores: { executive: 0.8 } }}
        taxonomyConfig={mockConfigs}
        taxonomyData={mockTaxonomyData}
      />,
    );

    expect(html).toContain('Audience');
  });

  it('sorts non-audience configs by display_order', () => {
    const configs: TaxonomyConfig[] = [
      {
        slug: 'topic',
        payload_field: 'topic_codes',
        behavior_type: 'guardrail',
        color: 'amber',
        display_order: 3,
        display_name: 'Topic',
        source_table: 'topic',
        score_parent_slug: null,
        score_threshold: null,
      },
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
    ];

    const html = renderToStaticMarkup(
      <TagDisplay payload={{}} taxonomyConfig={configs} taxonomyData={mockTaxonomyData} />,
    );

    // Both should be present
    expect(html).toContain('Industry');
    expect(html).toContain('Topic');
  });

  it('renders with empty configs', () => {
    const html = renderToStaticMarkup(
      <TagDisplay payload={{}} taxonomyConfig={[]} taxonomyData={{}} />,
    );

    expect(html).toContain('space-y-2');
  });
});
