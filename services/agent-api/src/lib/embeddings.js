/**
 * Embedding Service
 *
 * Uses OpenAI text-embedding-3-small for cost-effective semantic similarity.
 * ~$0.00002 per 1K tokens (~100x cheaper than LLM calls)
 *
 * KB-155: Agentic Discovery System - Phase 2
 */

import OpenAI from 'openai';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

// Lazy-load clients to avoid error at import time when env vars are missing
let openai = null;
let supabase = null;

function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

function getSupabase() {
  if (!supabase) {
    supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  }
  return supabase;
}

// Model config
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

// Similarity thresholds
const HIGH_RELEVANCE_THRESHOLD = 0.75; // Definitely relevant, skip LLM
const LOW_RELEVANCE_THRESHOLD = 0.45; // Definitely not relevant, skip
const UNCERTAIN_ZONE = { min: 0.45, max: 0.75 }; // Needs LLM scoring

// Cache for reference embedding (computed once per session)
let referenceEmbeddingCache = null;

/**
 * Generate embedding for a single text
 * @param {string} text - Text to embed
 * @returns {Promise<{embedding: number[], tokens: number}>}
 */
export async function generateEmbedding(text) {
  const response = await getOpenAI().embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, 8000), // Limit to avoid token overflow
  });

  return {
    embedding: response.data[0].embedding,
    tokens: response.usage.total_tokens,
  };
}

/**
 * Generate embeddings for multiple texts (batched)
 * @param {string[]} texts - Array of texts to embed
 * @returns {Promise<{embeddings: number[][], tokens: number}>}
 */
export async function generateEmbeddings(texts) {
  if (texts.length === 0) return { embeddings: [], tokens: 0 };

  // Limit each text and batch
  const truncatedTexts = texts.map((t) => t.slice(0, 8000));

  const response = await getOpenAI().embeddings.create({
    model: EMBEDDING_MODEL,
    input: truncatedTexts,
  });

  return {
    embeddings: response.data.map((d) => d.embedding),
    tokens: response.usage.total_tokens,
  };
}

/**
 * Calculate cosine similarity between two embeddings
 * @param {number[]} a - First embedding
 * @param {number[]} b - Second embedding
 * @returns {number} Similarity score between -1 and 1
 */
export function cosineSimilarity(a, b) {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have same dimensions');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/**
 * Build reference embedding from approved publications
 * This represents "what good executive-relevant content looks like"
 * @param {number} limit - Max publications to use
 * @returns {Promise<{embedding: number[], count: number, tokens: number}>}
 */
export async function buildReferenceEmbedding(limit = 50) {
  console.log('   📊 Building reference embedding from approved publications...');

  // Get approved publications with good content
  const { data: publications, error } = await getSupabase()
    .from('ingestion_queue')
    .select('payload')
    .eq('status', 'approved')
    .not('payload->summary->short', 'is', null)
    .order('reviewed_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load approved publications: ${error.message}`);
  }

  if (!publications || publications.length === 0) {
    console.log('   ⚠️ No approved publications found for reference embedding');
    return null;
  }

  // Build text representations
  const texts = publications
    .map((p) => {
      const payload = p.payload;
      return `${payload.title || ''}\n${payload.summary?.short || ''}\n${payload.description || ''}`.trim();
    })
    .filter((t) => t.length > 0);

  if (texts.length === 0) {
    return null;
  }

  // Generate embeddings for all texts
  const { embeddings, tokens } = await generateEmbeddings(texts);

  // Average the embeddings to create reference
  const referenceEmbedding = new Array(EMBEDDING_DIMENSIONS).fill(0);
  for (const emb of embeddings) {
    for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
      referenceEmbedding[i] += emb[i] / embeddings.length;
    }
  }

  console.log(`   ✅ Built reference from ${texts.length} publications (${tokens} tokens)`);

  return {
    embedding: referenceEmbedding,
    count: texts.length,
    tokens,
  };
}

/**
 * Get or build the reference embedding (cached)
 * @returns {Promise<number[]|null>}
 */
export async function getReferenceEmbedding() {
  if (referenceEmbeddingCache) {
    return referenceEmbeddingCache;
  }

  const result = await buildReferenceEmbedding();
  if (result) {
    referenceEmbeddingCache = result.embedding;
  }

  return referenceEmbeddingCache;
}

/**
 * Clear the reference embedding cache
 */
export function clearReferenceCache() {
  referenceEmbeddingCache = null;
}

/**
 * Score a candidate's relevance using embedding similarity
 * @param {Object} candidate - { title, description }
 * @param {number[]} referenceEmbedding - Reference embedding
 * @returns {Promise<{similarity: number, action: 'accept'|'reject'|'llm', tokens: number}>}
 */
export async function scoreWithEmbedding(candidate, referenceEmbedding) {
  const text = `${candidate.title || ''}\n${candidate.description || ''}`.trim();

  if (!text) {
    return { similarity: 0, action: 'llm', tokens: 0 };
  }

  const { embedding, tokens } = await generateEmbedding(text);
  const similarity = cosineSimilarity(embedding, referenceEmbedding);

  let action;
  if (similarity >= HIGH_RELEVANCE_THRESHOLD) {
    action = 'accept'; // High confidence relevant
  } else if (similarity < LOW_RELEVANCE_THRESHOLD) {
    action = 'reject'; // High confidence not relevant
  } else {
    action = 'llm'; // Uncertain, needs LLM scoring
  }

  return { similarity, action, tokens };
}

/**
 * Batch score candidates with embeddings
 * @param {Array} candidates - Array of { title, description }
 * @param {number[]} referenceEmbedding - Reference embedding
 * @returns {Promise<{results: Array, totalTokens: number}>}
 */
export async function batchScoreWithEmbeddings(candidates, referenceEmbedding) {
  if (candidates.length === 0) {
    return { results: [], totalTokens: 0 };
  }

  const texts = candidates.map((c) => `${c.title || ''}\n${c.description || ''}`.trim());

  const { embeddings, tokens } = await generateEmbeddings(texts);

  const results = embeddings.map((emb, i) => {
    const similarity = cosineSimilarity(emb, referenceEmbedding);

    let action;
    if (similarity >= HIGH_RELEVANCE_THRESHOLD) {
      action = 'accept';
    } else if (similarity < LOW_RELEVANCE_THRESHOLD) {
      action = 'reject';
    } else {
      action = 'llm';
    }

    return {
      ...candidates[i],
      similarity,
      action,
    };
  });

  return { results, totalTokens: tokens };
}

export {
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
  HIGH_RELEVANCE_THRESHOLD,
  LOW_RELEVANCE_THRESHOLD,
  UNCERTAIN_ZONE,
};
