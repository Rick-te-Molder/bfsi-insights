import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { DiscoveryControlCardView } from '@/components/dashboard/DiscoveryControlCardView';

describe('DiscoveryControlCardView', () => {
  it('renders paused state when disabled', () => {
    const html = renderToStaticMarkup(
      <DiscoveryControlCardView
        status={{ enabled: false, pendingCount: 10, sourceCount: 2 }}
        toggling={false}
        processing={false}
        batchSize={10}
        onChangeBatchSize={() => {}}
        onToggle={() => {}}
        onRun={() => {}}
        error={null}
        result={null}
      />,
    );

    expect(html).toContain('Discovery paused');
    expect(html).toContain('2 sources');
    expect(html).toContain('Run Discovery');
  });

  it('renders error and result messages', () => {
    const html = renderToStaticMarkup(
      <DiscoveryControlCardView
        status={{ enabled: true, pendingCount: 0, sourceCount: 5 }}
        toggling={false}
        processing={false}
        batchSize={25}
        onChangeBatchSize={() => {}}
        onToggle={() => {}}
        onRun={() => {}}
        error="boom"
        result={{ found: 7, new: 2 }}
      />,
    );

    expect(html).toContain('Discovery active');
    expect(html).toContain('boom');
    expect(html).toContain('Found 7, added 2 new items');
  });
});
