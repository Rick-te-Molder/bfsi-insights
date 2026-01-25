import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TagCategoryRow } from '@/components/tags/TagCategoryRow';

const baseConfig: any = {
  slug: 'topic',
  display_name: 'Topic',
  payload_field: 'topic',
  behavior_type: 'expandable',
  color: 'neutral',
};

describe('TagCategoryRow', () => {
  it('renders scoring row and shows dash when below threshold', () => {
    const config = {
      ...baseConfig,
      behavior_type: 'scoring',
      score_threshold: 0.9,
      payload_field: 'score',
    };
    const html = renderToStaticMarkup(
      <TagCategoryRow
        config={config}
        payload={{ score: 0.5 }}
        taxonomyData={{}}
        labelWidth="w-10"
      />,
    );
    expect(html).toContain('Topic');
    expect(html).toContain('—');
  });

  it('renders scoring row and shows percentage when above threshold', () => {
    const config = {
      ...baseConfig,
      behavior_type: 'scoring',
      score_threshold: 0.5,
      payload_field: 'score',
    };
    const html = renderToStaticMarkup(
      <TagCategoryRow config={config} payload={{ score: 0.75 }} taxonomyData={{}} />,
    );
    expect(html).toContain('75%');
  });

  it('renders expandable row with unknown validation marker', () => {
    const config = { ...baseConfig, behavior_type: 'expandable', payload_field: 'values' };
    const validationLookups: any = {
      topic: new Set(['known']),
    };

    const html = renderToStaticMarkup(
      <TagCategoryRow
        config={config}
        payload={{ values: ['Known', 'Unknown'] }}
        taxonomyData={{}}
        validationLookups={validationLookups}
        showValidation={true}
      />,
    );

    expect(html).toContain('Known');
    expect(html).toContain('Unknown');
    expect(html).toContain('⚠️');
  });

  it('renders code-based row and resolves names from taxonomyData', () => {
    const config = { ...baseConfig, behavior_type: 'code', payload_field: 'codes', slug: 'sector' };
    const taxonomyData: any = {
      sector: [{ code: 'A', name: 'Alpha' }],
    };

    const html = renderToStaticMarkup(
      <TagCategoryRow
        config={config}
        payload={{ codes: ['A', 'B'] }}
        taxonomyData={taxonomyData}
      />,
    );

    expect(html).toContain('Alpha');
    expect(html).toContain('B');
  });
});
