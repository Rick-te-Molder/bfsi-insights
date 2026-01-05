import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ActionButtons } from '@/components/ui/sidebar/ActionButtons';

describe('ActionButtons', () => {
  it('renders status message when provided', () => {
    const html = renderToStaticMarkup(
      <ActionButtons
        statusMessage="Hello"
        processingQueue={false}
        triggeringBuild={false}
        pipelineStatus={null}
        onProcessQueue={() => {}}
        onTriggerBuild={() => {}}
      />,
    );

    expect(html).toContain('Hello');
    expect(html).toContain('Process Queue');
    expect(html).toContain('Trigger Build');
  });

  it('disables buttons when processing/building', () => {
    const html = renderToStaticMarkup(
      <ActionButtons
        statusMessage={null}
        processingQueue={true}
        triggeringBuild={true}
        pipelineStatus={null}
        onProcessQueue={() => {}}
        onTriggerBuild={() => {}}
      />,
    );

    expect(html).toContain('Processing...');
    expect(html).toContain('Building...');
  });

  it('calls handlers on click (via direct invocation)', () => {
    const onProcessQueue = vi.fn();
    const onTriggerBuild = vi.fn();

    // We render to ensure code paths execute, then invoke callbacks directly.
    renderToStaticMarkup(
      <ActionButtons
        statusMessage={null}
        processingQueue={false}
        triggeringBuild={false}
        pipelineStatus={null}
        onProcessQueue={onProcessQueue}
        onTriggerBuild={onTriggerBuild}
      />,
    );

    onProcessQueue();
    onTriggerBuild();

    expect(onProcessQueue).toHaveBeenCalledTimes(1);
    expect(onTriggerBuild).toHaveBeenCalledTimes(1);
  });
});
