import { apiRequest, getPaper, searchPaper } from '../lib/semantic-scholar.js';

export const API_DELAY_MS = 500;

/** @param {number} ms */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** @param {any} classic */
export async function lookupClassicPaper(classic) {
  if (classic.doi) {
    const paper = await getPaper(`DOI:${classic.doi}`);
    if (paper) return paper;
  }

  if (classic.arxiv_id) {
    const paper = await getPaper(`ARXIV:${classic.arxiv_id}`);
    if (paper) return paper;
  }

  return searchPaper(classic.title);
}

/** @param {string} paperId @param {number} limit */
export async function getCitingPapers(paperId, limit) {
  const data = await apiRequest(`/paper/${paperId}/citations`, {
    fields: 'paperId,title,year,citationCount,influentialCitationCount,authors,url',
    limit: String(limit),
  });

  const typed = /** @type {{ data?: Array<{ citingPaper?: any }> } | null } */ (data);
  return typed?.data?.map((item) => item.citingPaper).filter(Boolean) || [];
}
