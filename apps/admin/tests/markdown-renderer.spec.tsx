import { describe, expect, it, vi, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

import { MarkdownRenderer } from '@/components/ui/markdown-renderer';

function renderIntoContainer(ui: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return { container, root };
}

describe('MarkdownRenderer', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('renders plain text initially (before mounted effect)', () => {
    const { container } = renderIntoContainer(<MarkdownRenderer content="**bold**" />);
    expect(container.textContent).toContain('bold');
  });

  it('renders markdown after mount', async () => {
    const { container } = renderIntoContainer(<MarkdownRenderer content="**bold**" />);

    await act(async () => {
      await Promise.resolve();
    });

    const strong = container.querySelector('strong');
    expect(strong?.textContent).toBe('bold');
  });
});
