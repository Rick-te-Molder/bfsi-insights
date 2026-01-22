import { describe, expect, it, vi } from 'vitest';

import { logLLMContentSent, logRawContentWarning } from './prompt-content-logger.js';

describe('lib/prompt-content-logger', () => {
  it('logLLMContentSent logs lengths for provided metadata fields', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(vi.fn());

    logLLMContentSent('agent', {
      title: 't',
      url: 'https://x',
      content: 'abc',
      summary: 'sum',
      description: 'desc',
      systemPrompt: 'sys',
      userContent: 'user',
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain('[agent]');
    expect(spy.mock.calls[0][0]).toContain('title=1 chars');
    expect(spy.mock.calls[0][0]).toContain('url=9 chars');
    expect(spy.mock.calls[0][0]).toContain('content=3 chars');
    expect(spy.mock.calls[0][0]).toContain('summary=3 chars');
    expect(spy.mock.calls[0][0]).toContain('description=4 chars');
    expect(spy.mock.calls[0][0]).toContain('systemPrompt=3 chars');
    expect(spy.mock.calls[0][0]).toContain('userContent=4 chars');

    spy.mockRestore();
  });

  it('logLLMContentSent logs no content metadata when no fields are set', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(vi.fn());

    logLLMContentSent('agent', {});

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain('no content metadata');

    spy.mockRestore();
  });

  it('logRawContentWarning only logs when totalChars is > 0', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(vi.fn());

    logRawContentWarning('agent', 0);
    expect(spy).not.toHaveBeenCalled();

    logRawContentWarning('agent', 10);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain('[agent]');
    expect(spy.mock.calls[0][0]).toContain('Sending 10 chars');

    spy.mockRestore();
  });
});
