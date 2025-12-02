/**
 * Classic Papers Discovery Agent
 *
 * Discovers foundational BFSI papers and citation-based expansions:
 * 1. Looks up classic papers via Semantic Scholar
 * 2. Finds papers that cite these classics (citation expansion)
 * 3. Adds high-quality citing papers to ingestion queue
 *
 * KB-155: Agentic Discovery System - Phase 5
 */

import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import {
  searchPaper,
  getPaper,
  extractCitationMetrics,
  calculateImpactScore,
} from '../lib/semantic-scholar.js';

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Minimum citation count for expansion papers
const MIN_CITATIONS_FOR_EXPANSION = 50;

// Minimum impact score for queueing
const MIN_IMPACT_SCORE = 4;

// Rate limit delay between API calls (ms)
const API_DELAY_MS = 500;

/**
 * Sleep for a given duration
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Load undiscovered classic papers from database
 */
async function loadUndiscoveredClassics(limit = 10) {
  const { data, error } = await supabase
    .from('classic_papers')
    .select('*')
    .eq('discovered', false)
    .order('created_at')
    .limit(limit);

  if (error) throw error;
  return data || [];
}

/**
 * Look up a classic paper in Semantic Scholar
 */
async function lookupClassicPaper(classic) {
  // Try DOI first
  if (classic.doi) {
    const paper = await getPaper(`DOI:${classic.doi}`);
    if (paper) return paper;
  }

  // Try arXiv ID
  if (classic.arxiv_id) {
    const paper = await getPaper(`ARXIV:${classic.arxiv_id}`);
    if (paper) return paper;
  }

  // Fall back to title search
  const paper = await searchPaper(classic.title);
  return paper;
}

/**
 * Get papers that cite a given paper
 */
async function getCitingPapers(paperId, limit = 20) {
  const url = `https://api.semanticscholar.org/graph/v1/paper/${paperId}/citations`;
  const params = new URLSearchParams({
    fields: 'paperId,title,year,citationCount,influentialCitationCount,authors,url',
    limit: String(limit),
  });

  try {
    const response = await fetch(`${url}?${params}`, {
      headers: { 'User-Agent': 'BFSI-Insights/1.0' },
    });

    if (!response.ok) return [];

    const data = await response.json();
    return data.data?.map((item) => item.citingPaper).filter(Boolean) || [];
  } catch {
    return [];
  }
}

/**
 * Check if a URL already exists in the queue or publications
 */
async function urlExists(url) {
  if (!url) return true; // Skip papers without URL

  const { data: queueItem } = await supabase
    .from('ingestion_queue')
    .select('id')
    .eq('url', url)
    .single();

  if (queueItem) return true;

  const { data: pub } = await supabase.from('kb_publication').select('id').eq('url', url).single();

  return !!pub;
}

/**
 * Add a paper to the ingestion queue
 */
async function queuePaper(paper, sourceClassic, isClassic = false) {
  const url = paper.url || `https://www.semanticscholar.org/paper/${paper.paperId}`;

  if (await urlExists(url)) {
    return { action: 'exists' };
  }

  const metrics = extractCitationMetrics(paper);
  const impactScore = calculateImpactScore(metrics);

  const payload = {
    title: paper.title,
    source: isClassic ? 'classic-paper' : 'citation-expansion',
    source_classic_id: sourceClassic?.id,
    source_classic_title: sourceClassic?.title,
    authors: paper.authors?.map((a) => a.name) || [],
    year: paper.year,
    semantic_scholar_id: paper.paperId,
    citation_count: metrics.citationCount,
    impact_score: impactScore,
  };

  const { data, error } = await supabase
    .from('ingestion_queue')
    .insert({
      url,
      status: 'pending',
      payload,
      relevance_score: Math.round(impactScore),
      executive_summary: isClassic
        ? `Classic paper: ${sourceClassic?.significance || 'Foundational BFSI literature'}`
        : `High-impact paper citing "${sourceClassic?.title}"`,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') return { action: 'exists' };
    throw error;
  }

  return { action: 'queued', id: data.id };
}

/**
 * Mark a classic paper as discovered
 */
async function markClassicDiscovered(classicId, semanticScholarId) {
  await supabase
    .from('classic_papers')
    .update({
      discovered: true,
      discovered_at: new Date().toISOString(),
      semantic_scholar_id: semanticScholarId,
    })
    .eq('id', classicId);
}

/**
 * Update classic paper citation count
 */
async function updateClassicCitations(classicId, citationCount) {
  await supabase
    .from('classic_papers')
    .update({ citation_count: citationCount })
    .eq('id', classicId);
}

/**
 * Run classic papers discovery
 */
export async function runClassicsDiscovery(options = {}) {
  const { limit = 5, expandCitations = true, dryRun = false } = options;

  console.log('📚 Starting Classic Papers Discovery...');
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`   Limit: ${limit} classics`);
  console.log(`   Citation expansion: ${expandCitations ? 'ON' : 'OFF'}`);

  const classics = await loadUndiscoveredClassics(limit);

  if (classics.length === 0) {
    console.log('✅ All classic papers have been discovered!');
    return { classics: 0, expansions: 0 };
  }

  console.log(`\n📖 Found ${classics.length} undiscovered classics\n`);

  const stats = {
    classicsProcessed: 0,
    classicsQueued: 0,
    expansionsQueued: 0,
    skipped: 0,
  };

  for (const classic of classics) {
    console.log(`📕 ${classic.title.substring(0, 60)}...`);
    console.log(`   Category: ${classic.category}`);

    await sleep(API_DELAY_MS);

    // Look up the classic paper
    const paper = await lookupClassicPaper(classic);

    if (!paper) {
      console.log('   ⚠️ Not found in Semantic Scholar');
      stats.skipped++;
      continue;
    }

    const metrics = extractCitationMetrics(paper);
    console.log(
      `   📊 Citations: ${metrics.citationCount}, Impact: ${calculateImpactScore(metrics)}/10`,
    );

    // Update citation count
    if (!dryRun) {
      await updateClassicCitations(classic.id, metrics.citationCount);
    }

    // Queue the classic paper itself
    if (dryRun) {
      console.log('   [DRY] Would queue classic paper');
    } else {
      const result = await queuePaper(paper, classic, true);
      if (result.action === 'queued') {
        console.log('   ✅ Queued classic paper');
        stats.classicsQueued++;
        await markClassicDiscovered(classic.id, paper.paperId);
      } else {
        console.log('   ⏭️ Already exists');
      }
    }

    stats.classicsProcessed++;

    // Citation expansion
    if (expandCitations && metrics.citationCount >= MIN_CITATIONS_FOR_EXPANSION) {
      console.log(`   🔍 Checking citing papers...`);
      await sleep(API_DELAY_MS);

      const citingPapers = await getCitingPapers(paper.paperId, 10);
      let expansionCount = 0;

      for (const citing of citingPapers) {
        const citingMetrics = extractCitationMetrics(citing);
        const citingImpact = calculateImpactScore(citingMetrics);

        // Only queue high-impact citing papers
        if (citingImpact >= MIN_IMPACT_SCORE) {
          if (dryRun) {
            console.log(`      [DRY] Would queue: ${citing.title?.substring(0, 50)}...`);
            expansionCount++;
          } else {
            const result = await queuePaper(citing, classic, false);
            if (result.action === 'queued') {
              console.log(`      ➕ ${citing.title?.substring(0, 50)}...`);
              expansionCount++;
              stats.expansionsQueued++;
            }
          }
        }

        await sleep(100); // Small delay between checks
      }

      if (expansionCount > 0) {
        console.log(`   📈 Found ${expansionCount} high-impact citing papers`);
      }
    }

    console.log('');
  }

  // Summary
  console.log('📊 Summary:');
  console.log(`   Classics processed: ${stats.classicsProcessed}`);
  console.log(`   Classics queued: ${stats.classicsQueued}`);
  console.log(`   Expansion papers queued: ${stats.expansionsQueued}`);
  console.log(`   Skipped (not found): ${stats.skipped}`);

  return {
    classics: stats.classicsQueued,
    expansions: stats.expansionsQueued,
  };
}
