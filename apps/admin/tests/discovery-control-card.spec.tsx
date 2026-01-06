import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { DiscoveryControlCard } from '@/components/dashboard/DiscoveryControlCard';

vi.mock('@/components/dashboard/useDiscoveryControl', () => {
  return {
    useDiscoveryControl: () => ({
      status: { enabled: false, pendingCount: 0, sourceCount: 3 },
      toggling: false,
      processing: false,
      batchSize: 10,
      setBatchSize: () => {},
      toggleDiscovery: () => {},
      runBatch: () => {},
      error: null,
      result: null,
    }),
  };
});

describe('DiscoveryControlCard', () => {
  it('renders view with model data', () => {
    const html = renderToStaticMarkup(<DiscoveryControlCard />);
    expect(html).toContain('Discovery');
    expect(html).toContain('3 sources');
  });
});
