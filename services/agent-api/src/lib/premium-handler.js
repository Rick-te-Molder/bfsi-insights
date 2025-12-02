/**
 * Premium Source Handler
 *
 * Handles content from paywalled/premium sources:
 * - headline_only: Extract title + link, skip full content
 * - landing_page: Scrape public landing pages for metadata
 * - manual_curation: Queue for human review with source link
 *
 * KB-155: Agentic Discovery System - Phase 4
 */

// Premium handling modes
export const PREMIUM_MODES = {
  HEADLINE_ONLY: 'headline_only', // Just capture title + URL from RSS
  LANDING_PAGE: 'landing_page', // Scrape public preview/landing page
  MANUAL_CURATION: 'manual_curation', // Queue for manual review
  SKIP: 'skip', // Don't process (current default)
};

// Default config for premium sources by category
const DEFAULT_PREMIUM_CONFIG = {
  // News publications (FT, Economist, etc.)
  publication: {
    mode: PREMIUM_MODES.HEADLINE_ONLY,
    extractPreview: true, // Try to get preview text from RSS
  },
  // Consultancies (McKinsey, BCG, etc.)
  consultancy: {
    mode: PREMIUM_MODES.LANDING_PAGE,
    selectors: {
      title: 'h1, .article-title',
      summary: '.article-summary, .excerpt, meta[name="description"]',
      authors: '.author-name, .byline',
      date: 'time, .publish-date, .date',
    },
  },
  // Default fallback
  default: {
    mode: PREMIUM_MODES.HEADLINE_ONLY,
    extractPreview: false,
  },
};

/**
 * Get premium handling config for a source
 * @param {Object} source - kb_source record
 * @returns {Object} Premium handling config
 */
export function getPremiumConfig(source) {
  // Check if source has custom premium config
  if (source.premium_config) {
    return {
      ...DEFAULT_PREMIUM_CONFIG.default,
      ...source.premium_config,
    };
  }

  // Use category-based default
  const category = source.category || 'default';
  return DEFAULT_PREMIUM_CONFIG[category] || DEFAULT_PREMIUM_CONFIG.default;
}

/**
 * Process a premium source candidate in headline_only mode
 * @param {Object} candidate - { title, url, description, published_at }
 * @param {Object} source - kb_source record
 * @returns {Object} Processed candidate for queue
 */
export function processHeadlineOnly(candidate, source) {
  return {
    url: candidate.url,
    title: candidate.title,
    description: candidate.description || null,
    published_at: candidate.published_at || null,
    source_slug: source.slug,
    source_name: source.name,
    premium: true,
    premium_mode: PREMIUM_MODES.HEADLINE_ONLY,
    // Mark as needing manual content fetch
    requires_manual_fetch: true,
    // Don't auto-enrich - wait for manual review
    skip_auto_enrich: true,
  };
}

/**
 * Extract preview metadata from RSS description
 * Some paywalled sources include preview text in RSS
 * @param {string} description - RSS description/summary
 * @returns {Object} Extracted preview data
 */
export function extractRssPreview(description) {
  if (!description) return { preview: null, wordCount: 0 };

  // Limit input length to prevent DoS attacks
  const safeInput = description.slice(0, 10000);

  // Strip HTML tags using iterative approach (ReDoS-safe)
  let textOnly = '';
  let inTag = false;
  for (const char of safeInput) {
    if (char === '<') {
      inTag = true;
      textOnly += ' ';
    } else if (char === '>') {
      inTag = false;
    } else if (!inTag) {
      textOnly += char;
    }
  }

  // Clean up whitespace and entities
  const cleaned = textOnly
    .replace(/&nbsp;/g, ' ')
    .split(/\s+/)
    .join(' ')
    .trim();

  // Truncate to reasonable preview length
  const preview = cleaned.length > 500 ? cleaned.slice(0, 500) + '...' : cleaned;

  return {
    preview,
    wordCount: cleaned.split(/\s+/).length,
    hasSubstantivePreview: cleaned.length > 100,
  };
}

/**
 * Build payload for premium queue item
 * @param {Object} candidate - Candidate data
 * @param {Object} source - Source config
 * @param {Object} options - Processing options
 * @returns {Object} Queue payload
 */
export function buildPremiumPayload(candidate, source, options = {}) {
  const previewData = extractRssPreview(candidate.description);
  const config = getPremiumConfig(source);

  return {
    title: candidate.title,
    url: candidate.url,
    source: source.name,
    source_slug: source.slug,
    source_tier: source.tier,
    source_domain: source.domain,

    // Premium-specific fields
    premium: true,
    premium_mode: config.mode,
    requires_manual_fetch: config.mode !== PREMIUM_MODES.LANDING_PAGE,

    // Preview data (if available from RSS)
    preview: previewData.preview,
    has_substantive_preview: previewData.hasSubstantivePreview,

    // Dates
    published_at: candidate.published_at || null,
    discovered_at: new Date().toISOString(),

    // Metadata
    raw_description: candidate.description || null,

    // Processing flags
    skip_auto_enrich: true,
    manual_review_required: true,

    // Optional overrides
    ...options,
  };
}

/**
 * Check if a source should be processed as premium
 * @param {Object} source - kb_source record
 * @returns {boolean}
 */
export function isPremiumSource(source) {
  return source.tier === 'premium';
}

/**
 * Get the appropriate processing mode for a premium source
 * @param {Object} source - kb_source record
 * @returns {string} Processing mode
 */
export function getPremiumMode(source) {
  const config = getPremiumConfig(source);
  return config.mode;
}

/**
 * Filter candidates for premium processing
 * Applies basic quality filters even for headline_only mode
 * @param {Array} candidates - Raw candidates from RSS/sitemap
 * @returns {Array} Filtered candidates
 */
export function filterPremiumCandidates(candidates) {
  return candidates.filter((candidate) => {
    // Must have title and URL
    if (!candidate.title || !candidate.url) return false;

    // Skip if title is too short (likely not an article)
    if (candidate.title.length < 10) return false;

    // Skip generic/navigation pages
    const skipPatterns = [
      /^home$/i,
      /^about$/i,
      /^contact$/i,
      /^subscribe$/i,
      /^sign.?in$/i,
      /^log.?in$/i,
    ];
    if (skipPatterns.some((pattern) => pattern.test(candidate.title))) {
      return false;
    }

    return true;
  });
}
