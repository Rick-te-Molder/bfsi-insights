import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TableTagDisplay } from '@/components/tags/TableTagDisplay';
import type { TaxonomyConfig } from '@/components/tags/types';

describe('TableTagDisplay', () => {
  const mockTaxonomyData = {
    industry: [
      { code: 'banking', name: 'Banking' },
      { code: 'insurance', name: 'Insurance' },
    ],
    geography: [
      { code: 'usa', name: 'United States' },
      { code: 'global', name: 'Global' },
    ],
    audience: [
      { code: 'executive', name: 'Executive' },
      { code: 'engineer', name: 'Engineer' },
    ],
  };

  const mockAudienceConfigs: TaxonomyConfig[] = [
    {
      slug: 'audience_executive',
      payload_field: 'audience_scores.executive',
      behavior_type: 'scoring',
      color: 'violet',
      display_order: 1,
      display_name: 'Executive',
      source_table: 'audience',
      score_parent_slug: 'audience',
      score_threshold: 0.5,
    },
  ];

  const mockNonAudienceConfigs: TaxonomyConfig[] = [
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

  const defaultProps = {
    payload: {},
    taxonomyData: mockTaxonomyData,
    labelWidth: 'w-24',
    showValidation: false,
    audienceConfigs: mockAudienceConfigs,
    sortedNonAudienceConfigs: mockNonAudienceConfigs,
    showPercentages: false,
    getAudienceLabel: (c: TaxonomyConfig) => c.display_name,
    getTopAudiences: () => [],
  };

  it('renders audience row when configs provided', () => {
    const html = renderToStaticMarkup(<TableTagDisplay {...defaultProps} />);
    expect(html).toContain('Audience');
  });

  it('renders industry row', () => {
    const html = renderToStaticMarkup(<TableTagDisplay {...defaultProps} />);
    expect(html).toContain('Industry');
  });

  it('renders geography row', () => {
    const html = renderToStaticMarkup(<TableTagDisplay {...defaultProps} />);
    expect(html).toContain('Geography');
  });

  it('shows dash when no audience scores', () => {
    const html = renderToStaticMarkup(<TableTagDisplay {...defaultProps} />);
    expect(html).toContain('—');
  });

  it('shows audience tags with percentages when enabled', () => {
    const props = {
      ...defaultProps,
      payload: { audience_scores: { executive: 0.8 } },
      showPercentages: true,
    };
    const html = renderToStaticMarkup(<TableTagDisplay {...props} />);
    expect(html).toContain('80%');
  });

  it('shows simple audience names when percentages disabled', () => {
    const props = {
      ...defaultProps,
      getTopAudiences: () => [{ slug: 'exec', name: 'Executive', score: 0.8 }],
    };
    const html = renderToStaticMarkup(<TableTagDisplay {...props} />);
    expect(html).toContain('Executive');
  });

  it('defaults geography to global when empty', () => {
    const html = renderToStaticMarkup(
      <TableTagDisplay {...defaultProps} payload={{ geography_codes: [] }} />,
    );
    expect(html).toContain('Global');
  });

  it('shows industry codes from payload', () => {
    const props = {
      ...defaultProps,
      payload: { industry_codes: ['banking'] },
    };
    const html = renderToStaticMarkup(<TableTagDisplay {...props} />);
    expect(html).toContain('Banking');
  });

  it('applies correct label width', () => {
    const html = renderToStaticMarkup(<TableTagDisplay {...defaultProps} labelWidth="w-32" />);
    expect(html).toContain('w-32');
  });

  it('renders with empty configs', () => {
    const props = {
      ...defaultProps,
      audienceConfigs: [],
      sortedNonAudienceConfigs: [],
    };
    const html = renderToStaticMarkup(<TableTagDisplay {...props} />);
    expect(html).toContain('space-y-2');
  });
});
