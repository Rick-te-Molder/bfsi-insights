import { getPaperByArxiv, getPaperByDoi, searchPaper } from './semantic-scholar-api.js';
import { extractCitationMetrics } from './semantic-scholar-metrics.js';
import { calculateImpactScore } from './semantic-scholar-scoring.js';

function extractArxivIdFromUrl(url) {
  return /(\d{4}\.\d{4,5})/.exec(url)?.[1] ?? null;
}

async function findPaper({ title, doi, arxivId, url }) {
  if (arxivId || url?.includes('arxiv.org')) {
    const id = arxivId || extractArxivIdFromUrl(url);
    if (id) return getPaperByArxiv(id);
  }

  if (doi) {
    return getPaperByDoi(doi);
  }

  if (title) {
    return searchPaper(title);
  }

  return null;
}

/**
 * Get citation data for a paper by title or identifier
 * @param {Object} options - { title, doi, arxivId, url }
 * @returns {Promise<{metrics: Object, impactScore: number}|null>}
 */
export async function getCitationData({ title, doi, arxivId, url }) {
  const paper = await findPaper({ title, doi, arxivId, url });
  if (!paper) return null;

  const metrics = extractCitationMetrics(paper);
  const impactScore = calculateImpactScore(metrics);

  return {
    paperId: paper.paperId,
    title: paper.title,
    metrics,
    impactScore,
  };
}
