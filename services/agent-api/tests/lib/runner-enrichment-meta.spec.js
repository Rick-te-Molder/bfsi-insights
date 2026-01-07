import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFetchQueuePayload, mockUpdateQueuePayload } = vi.hoisted(() => ({
  mockFetchQueuePayload: vi.fn(),
  mockUpdateQueuePayload: vi.fn(),
}));

vi.mock('../../src/lib/runner-db.js', () => ({
  fetchQueuePayload: mockFetchQueuePayload,
  updateQueuePayload: mockUpdateQueuePayload,
}));

import { writeEnrichmentMetaToQueue } from '../../src/lib/runner-enrichment-meta.js';

describe('lib/runner-enrichment-meta', () => {
  beforeEach(() => {
    mockFetchQueuePayload.mockReset();
    mockUpdateQueuePayload.mockReset();
  });

  it('skips when agent name does not map to an enrichment step', async () => {
    const res = await writeEnrichmentMetaToQueue({
      supabase: { sb: true },
      agentName: 'unknown-agent',
      queueId: 'q1',
      promptConfig: { id: 'p1', version: 'v1', model_id: 'm1' },
      llmModel: 'm2',
    });

    expect(res).toEqual({ skipped: true });
    expect(mockFetchQueuePayload).not.toHaveBeenCalled();
    expect(mockUpdateQueuePayload).not.toHaveBeenCalled();
  });

  it('returns fetch error if queue payload fetch fails', async () => {
    const fetchError = { message: 'nope' };
    mockFetchQueuePayload.mockResolvedValue({ data: null, error: fetchError });

    const res = await writeEnrichmentMetaToQueue({
      supabase: { sb: true },
      agentName: 'summarizer',
      queueId: 'q1',
      promptConfig: { id: 'p1', version: 'v1', model_id: 'm1' },
      llmModel: 'm2',
    });

    expect(res).toEqual({ error: fetchError });
    expect(mockUpdateQueuePayload).not.toHaveBeenCalled();
  });

  it('writes enrichment meta to payload for mapped agent', async () => {
    const existingPayload = { a: 1, enrichment_meta: { old: { ok: true } } };
    mockFetchQueuePayload.mockResolvedValue({ data: { payload: existingPayload }, error: null });
    mockUpdateQueuePayload.mockResolvedValue({ error: null });

    const before = Date.now();
    const res = await writeEnrichmentMetaToQueue({
      supabase: { sb: true },
      agentName: 'tagger',
      queueId: 'q1',
      promptConfig: { id: 'p1', version: 'v1', model_id: 'm1' },
      llmModel: 'm2',
    });

    expect(res).toEqual({ stepKey: 'tag' });

    expect(mockFetchQueuePayload).toHaveBeenCalledWith({ sb: true }, 'q1');
    const call = mockUpdateQueuePayload.mock.calls[0];
    expect(call[0]).toEqual({ sb: true });
    expect(call[1]).toBe('q1');

    const updatedPayload = call[2];
    expect(updatedPayload.a).toBe(1);
    expect(updatedPayload.enrichment_meta.old).toEqual({ ok: true });
    expect(updatedPayload.enrichment_meta.tag.prompt_version_id).toBe('p1');
    expect(updatedPayload.enrichment_meta.tag.prompt_version).toBe('v1');
    expect(updatedPayload.enrichment_meta.tag.llm_model).toBe('m2');

    const processedAt = Date.parse(updatedPayload.enrichment_meta.tag.processed_at);
    expect(processedAt).toBeGreaterThanOrEqual(before);
  });

  it('returns update error if queue payload update fails', async () => {
    mockFetchQueuePayload.mockResolvedValue({ data: { payload: {} }, error: null });
    const updateError = { message: 'update failed' };
    mockUpdateQueuePayload.mockResolvedValue({ error: updateError });

    const res = await writeEnrichmentMetaToQueue({
      supabase: { sb: true },
      agentName: 'thumbnail-generator',
      queueId: 'q1',
      promptConfig: { id: 'p1', version: 'v1', model_id: 'm1' },
      llmModel: undefined,
    });

    expect(res).toEqual({ error: updateError });
  });
});
