import { loadStatusCodes, STATUS } from '../lib/status-codes.js';
import { calculateImpactScore, extractCitationMetrics } from '../lib/semantic-scholar.js';
import { insertQueueItem, urlExists } from './discover-classics-db.js';

/** @param {any} paper */
function getPaperUrl(paper) {
  return paper.url || `https://www.semanticscholar.org/paper/${paper.paperId}`;
}

/** @param {any} paper @param {any} sourceClassic @param {boolean} isClassic @param {any} metrics @param {number} impactScore */
function buildPayload(paper, sourceClassic, isClassic, metrics, impactScore) {
  return {
    title: paper.title,
    source: isClassic ? 'classic-paper' : 'citation-expansion',
    source_classic_id: sourceClassic?.id,
    source_classic_title: sourceClassic?.title,
    authors: paper.authors?.map(/** @type {(a: any) => any} */ ((a) => a.name)) || [],
    year: paper.year,
    semantic_scholar_id: paper.paperId,
    citation_count: metrics.citationCount,
    impact_score: impactScore,
  };
}

/** @param {any} sourceClassic @param {boolean} isClassic */
function buildExecutiveSummary(sourceClassic, isClassic) {
  if (isClassic) {
    return `Classic paper: ${sourceClassic?.significance || 'Foundational BFSI literature'}`;
  }

  return `High-impact paper citing "${sourceClassic?.title}"`;
}

/** @param {any} paper @param {any} sourceClassic @param {boolean} isClassic */
async function createQueueInsertRow(paper, sourceClassic, isClassic) {
  await loadStatusCodes();
  const status = /** @type {any} */ (STATUS);

  const url = getPaperUrl(paper);
  const metrics = extractCitationMetrics(paper);
  const impactScore = calculateImpactScore(metrics);

  return {
    url,
    status_code: status.PENDING_ENRICHMENT,
    payload: buildPayload(paper, sourceClassic, isClassic, metrics, impactScore),
    relevance_score: Math.round(impactScore),
    executive_summary: buildExecutiveSummary(sourceClassic, isClassic),
  };
}

/** @param {any} paper @param {any} sourceClassic @param {boolean} isClassic */
export async function queuePaper(paper, sourceClassic, isClassic) {
  const url = getPaperUrl(paper);
  if (await urlExists(url)) return { action: 'exists' };

  const row = await createQueueInsertRow(paper, sourceClassic, isClassic);
  const { data, error } = await insertQueueItem(row);

  if (error) {
    if (error.code === '23505') return { action: 'exists' };
    throw error;
  }

  return { action: 'queued', id: data.id };
}
