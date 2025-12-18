/**
 * Tests for embeddings.js
 *
 * Focus:
 * - Cosine similarity calculation
 * - Thresholds and action determination
 * - Reference embedding caching
 *
 * KB-155: Agentic Discovery System - Phase 2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mocks
const { mockEmbeddingsCreate, mockSupabaseSelect } = vi.hoisted(() => ({
  mockEmbeddingsCreate: vi.fn(),
  mockSupabaseSelect: vi.fn(),
}));

vi.mock('openai', () => ({
  default: class MockOpenAI {
    constructor() {
      this.embeddings = { create: mockEmbeddingsCreate };
    }
  },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: mockSupabaseSelect,
    })),
  })),
}));

import {
  cosineSimilarity,
  generateEmbedding,
  generateEmbeddings,
  scoreWithEmbedding,
  batchScoreWithEmbeddings,
  clearReferenceCache,
  HIGH_RELEVANCE_THRESHOLD,
  LOW_RELEVANCE_THRESHOLD,
  EMBEDDING_DIMENSIONS,
} from '../../src/lib/embeddings.js';

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const a = [1, 0, 0];
    const b = [1, 0, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(1);
  });

  it('returns 0 for orthogonal vectors', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0);
  });

  it('returns -1 for opposite vectors', () => {
    const a = [1, 0, 0];
    const b = [-1, 0, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1);
  });

  it('returns ~0.707 for 45-degree angle', () => {
    const a = [1, 0];
    const b = [1, 1];
    // cos(45°) ≈ 0.707
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.707, 2);
  });

  it('throws error for different dimensions', () => {
    const a = [1, 0, 0];
    const b = [1, 0];
    expect(() => cosineSimilarity(a, b)).toThrow('same dimensions');
  });

  it('returns 0 for zero vectors', () => {
    const a = [0, 0, 0];
    const b = [1, 0, 0];
    expect(cosineSimilarity(a, b)).toBe(0);
  });
});

describe('generateEmbedding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls OpenAI with correct model and returns embedding', async () => {
    const mockEmbedding = new Array(1536).fill(0.1);
    mockEmbeddingsCreate.mockResolvedValue({
      data: [{ embedding: mockEmbedding }],
      usage: { total_tokens: 10 },
    });

    const result = await generateEmbedding('Test text');

    expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
      model: 'text-embedding-3-small',
      input: 'Test text',
    });
    expect(result.embedding).toEqual(mockEmbedding);
    expect(result.tokens).toBe(10);
  });

  it('truncates text longer than 8000 characters', async () => {
    const longText = 'a'.repeat(10000);
    mockEmbeddingsCreate.mockResolvedValue({
      data: [{ embedding: [0.1] }],
      usage: { total_tokens: 10 },
    });

    await generateEmbedding(longText);

    const callInput = mockEmbeddingsCreate.mock.calls[0][0].input;
    expect(callInput.length).toBe(8000);
  });
});

describe('generateEmbeddings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles empty array', async () => {
    const result = await generateEmbeddings([]);
    expect(result.embeddings).toEqual([]);
    expect(result.tokens).toBe(0);
  });

  it('batches multiple texts', async () => {
    mockEmbeddingsCreate.mockResolvedValue({
      data: [{ embedding: [0.1] }, { embedding: [0.2] }],
      usage: { total_tokens: 20 },
    });

    const result = await generateEmbeddings(['text1', 'text2']);

    expect(result.embeddings).toHaveLength(2);
    expect(result.tokens).toBe(20);
  });
});

describe('scoreWithEmbedding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns accept for high similarity', async () => {
    // Create embeddings with high similarity
    const referenceEmbedding = new Array(1536).fill(0.1);
    const candidateEmbedding = new Array(1536).fill(0.1); // Identical = similarity 1.0

    mockEmbeddingsCreate.mockResolvedValue({
      data: [{ embedding: candidateEmbedding }],
      usage: { total_tokens: 10 },
    });

    const result = await scoreWithEmbedding(
      { title: 'Test', description: 'Desc' },
      referenceEmbedding,
    );

    expect(result.similarity).toBeCloseTo(1);
    expect(result.action).toBe('accept');
  });

  it('returns reject for low similarity', async () => {
    // Create orthogonal embeddings (similarity ~0)
    const referenceEmbedding = new Array(1536).fill(0);
    referenceEmbedding[0] = 1;

    const candidateEmbedding = new Array(1536).fill(0);
    candidateEmbedding[1] = 1;

    mockEmbeddingsCreate.mockResolvedValue({
      data: [{ embedding: candidateEmbedding }],
      usage: { total_tokens: 10 },
    });

    const result = await scoreWithEmbedding(
      { title: 'Test', description: 'Desc' },
      referenceEmbedding,
    );

    expect(result.similarity).toBeCloseTo(0);
    expect(result.action).toBe('reject');
  });

  it('returns llm for uncertain similarity', async () => {
    // Create embeddings with similarity in uncertain zone
    const referenceEmbedding = new Array(1536).fill(0.1);
    const candidateEmbedding = new Array(1536).fill(0);

    // Set some overlap to get ~0.5-0.7 similarity
    for (let i = 0; i < 768; i++) {
      candidateEmbedding[i] = 0.1;
    }

    mockEmbeddingsCreate.mockResolvedValue({
      data: [{ embedding: candidateEmbedding }],
      usage: { total_tokens: 10 },
    });

    const result = await scoreWithEmbedding(
      { title: 'Test', description: 'Desc' },
      referenceEmbedding,
    );

    // Similarity should be around 0.5-0.7 (uncertain zone)
    expect(result.similarity).toBeGreaterThan(LOW_RELEVANCE_THRESHOLD);
    expect(result.similarity).toBeLessThan(HIGH_RELEVANCE_THRESHOLD);
    expect(result.action).toBe('llm');
  });

  it('handles empty text', async () => {
    const result = await scoreWithEmbedding(
      { title: '', description: '' },
      new Array(1536).fill(0.1),
    );

    expect(result.action).toBe('llm');
    expect(result.tokens).toBe(0);
  });
});

describe('thresholds', () => {
  it('HIGH_RELEVANCE_THRESHOLD is reasonable', () => {
    expect(HIGH_RELEVANCE_THRESHOLD).toBeGreaterThan(0.5);
    expect(HIGH_RELEVANCE_THRESHOLD).toBeLessThanOrEqual(1);
  });

  it('LOW_RELEVANCE_THRESHOLD is reasonable', () => {
    expect(LOW_RELEVANCE_THRESHOLD).toBeGreaterThan(0);
    expect(LOW_RELEVANCE_THRESHOLD).toBeLessThan(0.7);
  });

  it('thresholds dont overlap', () => {
    expect(LOW_RELEVANCE_THRESHOLD).toBeLessThan(HIGH_RELEVANCE_THRESHOLD);
  });
});

describe('constants', () => {
  it('EMBEDDING_DIMENSIONS matches model output', () => {
    expect(EMBEDDING_DIMENSIONS).toBe(1536);
  });
});

describe('clearReferenceCache', () => {
  it('clears the cache without error', () => {
    expect(() => clearReferenceCache()).not.toThrow();
  });
});

describe('batchScoreWithEmbeddings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles empty array', async () => {
    const result = await batchScoreWithEmbeddings([], [0.1]);
    expect(result.results).toEqual([]);
    expect(result.totalTokens).toBe(0);
  });

  it('scores multiple candidates with correct actions', async () => {
    const referenceEmbedding = new Array(1536).fill(0.1);

    // Mock embeddings that will produce different similarities
    const highSimilarityEmb = new Array(1536).fill(0.1); // Same as reference = 1.0
    const lowSimilarityEmb = new Array(1536).fill(0);
    lowSimilarityEmb[0] = 1; // Orthogonal to reference

    mockEmbeddingsCreate.mockResolvedValue({
      data: [{ embedding: highSimilarityEmb }, { embedding: lowSimilarityEmb }],
      usage: { total_tokens: 20 },
    });

    const candidates = [
      { title: 'High match', description: 'desc' },
      { title: 'Low match', description: 'desc' },
    ];

    const result = await batchScoreWithEmbeddings(candidates, referenceEmbedding);

    expect(result.results).toHaveLength(2);
    expect(result.totalTokens).toBe(20);
    expect(result.results[0].action).toBe('accept');
    expect(result.results[1].action).toBe('reject');
  });

  it('preserves candidate properties in results', async () => {
    mockEmbeddingsCreate.mockResolvedValue({
      data: [{ embedding: new Array(1536).fill(0.1) }],
      usage: { total_tokens: 10 },
    });

    const candidates = [{ title: 'Test', description: 'Desc', customProp: 'value' }];
    const result = await batchScoreWithEmbeddings(candidates, new Array(1536).fill(0.1));

    expect(result.results[0].title).toBe('Test');
    expect(result.results[0].customProp).toBe('value');
    expect(result.results[0].similarity).toBeDefined();
    expect(result.results[0].action).toBeDefined();
  });

  it('returns llm action for uncertain similarity', async () => {
    const referenceEmbedding = new Array(1536).fill(0.1);

    // Create embedding with ~0.5-0.7 similarity (uncertain zone)
    const uncertainEmb = new Array(1536).fill(0);
    for (let i = 0; i < 768; i++) {
      uncertainEmb[i] = 0.1;
    }

    mockEmbeddingsCreate.mockResolvedValue({
      data: [{ embedding: uncertainEmb }],
      usage: { total_tokens: 10 },
    });

    const candidates = [{ title: 'Uncertain', description: 'test' }];
    const result = await batchScoreWithEmbeddings(candidates, referenceEmbedding);

    expect(result.results[0].action).toBe('llm');
    expect(result.results[0].similarity).toBeGreaterThan(LOW_RELEVANCE_THRESHOLD);
    expect(result.results[0].similarity).toBeLessThan(HIGH_RELEVANCE_THRESHOLD);
  });
});
