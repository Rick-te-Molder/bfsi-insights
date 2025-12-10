'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface TaggedCode {
  code: string;
  confidence: number;
}

interface QueueItem {
  id: string;
  url: string;
  status: string;
  payload: {
    title?: string;
    summary?: { short?: string; medium?: string; long?: string };
    thumbnail?: string;
    thumbnail_path?: string;
    thumbnail_bucket?: string;
    published_at?: string;
    source_slug?: string;
    relevance_confidence?: number;
    // Tag codes (can be string[] or TaggedCode[])
    industry_codes?: (string | TaggedCode)[];
    topic_codes?: (string | TaggedCode)[];
    geography_codes?: (string | TaggedCode)[];
    process_codes?: (string | TaggedCode)[];
    regulator_codes?: (string | TaggedCode)[];
    regulation_codes?: string[];
    // Free-text entities
    vendor_names?: string[];
    organization_names?: string[];
    // Persona relevance scores
    persona_scores?: {
      executive?: number;
      technical?: number;
      compliance?: number;
    };
  };
  discovered_at: string;
}

interface TaxonomyItem {
  code: string;
  name: string;
}

interface Taxonomies {
  industries: TaxonomyItem[];
  topics: TaxonomyItem[];
  geographies: TaxonomyItem[];
  processes: TaxonomyItem[];
  regulators: TaxonomyItem[];
  regulations: TaxonomyItem[];
}

interface CarouselReviewProps {
  initialItems: QueueItem[];
  taxonomies: Taxonomies;
}

// Summary length specs
const SUMMARY_SPECS = {
  short: { min: 120, max: 150 },
  medium: { min: 250, max: 300 },
  long: { min: 500, max: 600 },
};

export function CarouselReview({ initialItems, taxonomies }: CarouselReviewProps) {
  const [items, setItems] = useState(initialItems);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editedTitle, setEditedTitle] = useState('');
  const [processing, setProcessing] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Build lookup maps for all taxonomies
  const industryMap = new Map(taxonomies.industries.map((i) => [i.code, i.name]));
  const topicMap = new Map(taxonomies.topics.map((t) => [t.code, t.name]));
  const geographyMap = new Map(taxonomies.geographies.map((g) => [g.code, g.name]));
  const processMap = new Map(taxonomies.processes.map((p) => [p.code, p.name]));
  const regulatorMap = new Map(taxonomies.regulators.map((r) => [r.code, r.name]));
  const regulationMap = new Map(taxonomies.regulations.map((r) => [r.code, r.name]));

  const currentItem = items[currentIndex];

  // Update edited title when item changes
  useEffect(() => {
    if (currentItem?.payload?.title) {
      setEditedTitle(currentItem.payload.title);
    }
  }, [currentItem]);

  const handleApprove = useCallback(async () => {
    if (!currentItem || processing) return;
    setProcessing(true);

    try {
      const payload = currentItem.payload || {};
      const summary = payload.summary || {};
      const title = editedTitle || payload.title || 'Untitled';
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80);

      // Update title if changed
      if (editedTitle !== payload.title) {
        await supabase
          .from('ingestion_queue')
          .update({ payload: { ...payload, title: editedTitle } })
          .eq('id', currentItem.id);
      }

      // Create publication
      await supabase.from('kb_publication').insert({
        slug: `${slug}-${Date.now()}`,
        title,
        source_url: currentItem.url,
        source_slug: payload.source_slug || 'manual',
        published_at: new Date().toISOString(),
        summary_short: summary.short || '',
        summary_medium: summary.medium || '',
        summary_long: summary.long || '',
      });

      // Update queue status
      await supabase
        .from('ingestion_queue')
        .update({ status: 'approved' })
        .eq('id', currentItem.id);

      // Remove from list
      const newItems = items.filter((_, i) => i !== currentIndex);
      setItems(newItems);
      if (currentIndex >= newItems.length) {
        setCurrentIndex(Math.max(0, newItems.length - 1));
      }

      if (newItems.length === 0) {
        router.refresh();
      }
    } catch (err) {
      console.error('Approve error:', err);
      alert('Approve failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setProcessing(false);
    }
  }, [currentItem, editedTitle, currentIndex, items, processing, supabase, router]);

  const handleReject = useCallback(async () => {
    if (!currentItem || processing) return;

    const reason = window.prompt('Reason for rejection (optional):');
    if (reason === null) return;

    setProcessing(true);

    try {
      await supabase
        .from('ingestion_queue')
        .update({
          status: 'rejected',
          payload: { ...currentItem.payload, rejection_reason: reason || null },
        })
        .eq('id', currentItem.id);

      const newItems = items.filter((_, i) => i !== currentIndex);
      setItems(newItems);
      if (currentIndex >= newItems.length) {
        setCurrentIndex(Math.max(0, newItems.length - 1));
      }

      if (newItems.length === 0) {
        router.refresh();
      }
    } catch (err) {
      alert('Reject failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setProcessing(false);
    }
  }, [currentItem, currentIndex, items, processing, supabase, router]);

  const handleReenrich = useCallback(async () => {
    if (!currentItem || processing) return;
    setProcessing(true);

    try {
      await supabase.from('ingestion_queue').update({ status: 'queued' }).eq('id', currentItem.id);

      const newItems = items.filter((_, i) => i !== currentIndex);
      setItems(newItems);
      if (currentIndex >= newItems.length) {
        setCurrentIndex(Math.max(0, newItems.length - 1));
      }

      if (newItems.length === 0) {
        router.refresh();
      }
    } catch (err) {
      alert('Re-enrich failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setProcessing(false);
    }
  }, [currentItem, currentIndex, items, processing, supabase, router]);

  // Keyboard navigation - must be after handler definitions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (processing) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setCurrentIndex((i) => i - 1);
      } else if (e.key === 'ArrowRight' && currentIndex < items.length - 1) {
        setCurrentIndex((i) => i + 1);
      } else if (e.key === 'a' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleApprove();
      } else if (e.key === 'r' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleReject();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, items.length, processing, handleApprove, handleReject]);

  if (!currentItem) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-12 text-center">
        <p className="text-neutral-400">No items to review</p>
      </div>
    );
  }

  const payload = currentItem.payload || {};
  const summary = payload.summary || {};

  // Extract codes from tagged items (handle both {code, confidence} objects and strings)
  const extractCodes = (items: unknown[]): string[] => {
    if (!items || !Array.isArray(items)) return [];
    return items
      .map((item) =>
        typeof item === 'object' && item !== null ? (item as { code?: string }).code : item,
      )
      .filter((c): c is string => typeof c === 'string' && c !== 'null' && c !== '');
  };

  const industryCodes = extractCodes(payload.industry_codes as unknown[]);
  const topicCodes = extractCodes(payload.topic_codes as unknown[]);
  const geographyCodes = extractCodes(payload.geography_codes as unknown[]);
  const processCodes = extractCodes(payload.process_codes as unknown[]);
  const regulatorCodes = extractCodes(payload.regulator_codes as unknown[]);
  const regulationCodes = extractCodes(payload.regulation_codes as unknown[]);
  const vendorNames = ((payload.vendor_names as string[]) || []).filter((v) => v && v !== 'null');
  const organizationNames = ((payload.organization_names as string[]) || []).filter(
    (o) => o && o !== 'null',
  );
  const personaScores =
    (payload.persona_scores as { executive?: number; technical?: number; compliance?: number }) ||
    {};

  // Resolve thumbnail
  let thumbnailUrl = payload.thumbnail || null;
  if (!thumbnailUrl && payload.thumbnail_path && payload.thumbnail_bucket) {
    thumbnailUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${payload.thumbnail_bucket}/${payload.thumbnail_path}`;
  }

  // Summary validation
  const shortLen = summary.short?.length || 0;
  const mediumLen = summary.medium?.length || 0;
  const longLen = summary.long?.length || 0;

  const getStatus = (len: number, spec: { min: number; max: number }) => {
    if (len < spec.min) return { icon: '↓', color: 'text-amber-400', label: 'short' };
    if (len > spec.max) return { icon: '↑', color: 'text-red-400', label: 'long' };
    return { icon: '✓', color: 'text-emerald-400', label: 'ok' };
  };

  const shortStatus = getStatus(shortLen, SUMMARY_SPECS.short);
  const mediumStatus = getStatus(mediumLen, SUMMARY_SPECS.medium);
  const longStatus = getStatus(longLen, SUMMARY_SPECS.long);

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
          className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ← Previous
        </button>

        {/* Dots */}
        <div className="flex gap-1.5 max-w-md overflow-x-auto py-1">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`w-2.5 h-2.5 rounded-full transition-colors flex-shrink-0 ${
                i === currentIndex ? 'bg-sky-500' : 'bg-neutral-700 hover:bg-neutral-600'
              }`}
            />
          ))}
        </div>

        <button
          onClick={() => setCurrentIndex((i) => Math.min(items.length - 1, i + 1))}
          disabled={currentIndex >= items.length - 1}
          className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next →
        </button>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr,400px] gap-6">
        {/* Left: Card Preview */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide">
              📰 Card Preview (as it will appear)
            </h2>
            <span className="text-sm text-neutral-500">
              {currentIndex + 1} of {items.length}
            </span>
          </div>

          {/* Publication Card */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 shadow-sm ring-1 ring-neutral-800/40">
            <h3 className="text-xl font-semibold text-sky-200 line-clamp-2">
              {payload.title || 'Untitled'}
            </h3>

            <div className="mt-1 text-sm">
              <span className="text-neutral-400">Published</span>{' '}
              {payload.published_at ? (
                <span className="text-neutral-200">
                  {new Date(payload.published_at).toLocaleDateString('en-GB', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              ) : (
                <span className="text-red-400">⚠️ Not extracted</span>
              )}
            </div>

            {/* Thumbnail */}
            <div
              className="relative mt-2 w-full rounded-md border border-neutral-800 bg-neutral-800/40 overflow-hidden"
              style={{ aspectRatio: '16 / 9' }}
            >
              {thumbnailUrl ? (
                <img
                  src={thumbnailUrl}
                  alt="Preview"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg
                    className="h-10 w-10 text-neutral-700"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              )}
            </div>

            {summary.short && (
              <p className="mt-2 text-sm text-neutral-300 line-clamp-2">{summary.short}</p>
            )}

            {/* Tags */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {industryCodes.slice(0, 2).map((code) => (
                <span
                  key={code}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-300 ring-1 ring-inset ring-blue-500/20"
                >
                  {industryMap.get(code) || code}
                </span>
              ))}
              {topicCodes.slice(0, 2).map((code) => (
                <span
                  key={code}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-300 ring-1 ring-inset ring-purple-500/20"
                >
                  {topicMap.get(code) || code}
                </span>
              ))}
            </div>
          </div>

          {/* Source URL */}
          <a
            href={currentItem.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-sm text-neutral-500 hover:text-sky-400 truncate"
          >
            🔗 {currentItem.url}
          </a>
        </div>

        {/* Right: Admin Panel */}
        <div className="space-y-4">
          {/* Edit Title */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
            <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-2">
              Edit Title
            </h3>
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
            <p className="text-xs text-neutral-500 mt-1">Edit before approving</p>
          </div>

          {/* Actions */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide">
              Actions
            </h3>
            <button
              onClick={handleApprove}
              disabled={processing}
              className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-lg font-semibold text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
            >
              {processing ? '⏳ Processing...' : '✓ Approve & Publish'}
            </button>
            <button
              onClick={handleReject}
              disabled={processing}
              className="w-full rounded-lg bg-red-600/80 px-4 py-2.5 font-medium text-white hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              ✗ Reject
            </button>
            <button
              onClick={handleReenrich}
              disabled={processing}
              className="w-full rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-300 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
            >
              🔄 Re-enrich
            </button>
            <p className="text-xs text-neutral-600 text-center">
              Shortcuts: <kbd className="px-1 bg-neutral-800 rounded">A</kbd> approve,{' '}
              <kbd className="px-1 bg-neutral-800 rounded">R</kbd> reject,{' '}
              <kbd className="px-1 bg-neutral-800 rounded">←</kbd>
              <kbd className="px-1 bg-neutral-800 rounded">→</kbd> navigate
            </p>
          </div>

          {/* Quality Metrics */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
            <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-3">
              Quality Metrics
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">
                  Short <span className="text-neutral-500">(120-150)</span>
                </span>
                <span className={shortStatus.color}>
                  {shortStatus.icon} {shortLen}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">
                  Medium <span className="text-neutral-500">(250-300)</span>
                </span>
                <span className={mediumStatus.color}>
                  {mediumStatus.icon} {mediumLen}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">
                  Long <span className="text-neutral-500">(500-600)</span>
                </span>
                <span className={longStatus.color}>
                  {longStatus.icon} {longLen}
                </span>
              </div>
              {payload.relevance_confidence && (
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">AI Confidence</span>
                  <span className="text-emerald-400">
                    {(payload.relevance_confidence * 100).toFixed(0)}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Tags - All 9 categories always visible */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
            <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-3">
              Tags
            </h3>
            <div className="space-y-2 text-xs">
              {/* Industry */}
              <div className="flex items-start justify-between gap-2">
                <span className="text-neutral-500 shrink-0 w-24">Industry</span>
                <div className="flex flex-wrap gap-1 justify-end">
                  {industryCodes.length > 0 ? (
                    industryCodes.map((code) => (
                      <span
                        key={code}
                        className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300"
                      >
                        {industryMap.get(code) || code}
                      </span>
                    ))
                  ) : (
                    <span className="text-neutral-600 italic">—</span>
                  )}
                </div>
              </div>
              {/* Topic */}
              <div className="flex items-start justify-between gap-2">
                <span className="text-neutral-500 shrink-0 w-24">Topic</span>
                <div className="flex flex-wrap gap-1 justify-end">
                  {topicCodes.length > 0 ? (
                    topicCodes.map((code) => (
                      <span
                        key={code}
                        className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300"
                      >
                        {topicMap.get(code) || code}
                      </span>
                    ))
                  ) : (
                    <span className="text-neutral-600 italic">—</span>
                  )}
                </div>
              </div>
              {/* Geography */}
              <div className="flex items-start justify-between gap-2">
                <span className="text-neutral-500 shrink-0 w-24">Geography</span>
                <div className="flex flex-wrap gap-1 justify-end">
                  {geographyCodes.length > 0 ? (
                    geographyCodes.map((code) => (
                      <span
                        key={code}
                        className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300"
                      >
                        {geographyMap.get(code) || code}
                      </span>
                    ))
                  ) : (
                    <span className="text-neutral-600 italic">—</span>
                  )}
                </div>
              </div>
              {/* Process */}
              <div className="flex items-start justify-between gap-2">
                <span className="text-neutral-500 shrink-0 w-24">Process</span>
                <div className="flex flex-wrap gap-1 justify-end">
                  {processCodes.length > 0 ? (
                    processCodes.map((code) => (
                      <span
                        key={code}
                        className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300"
                      >
                        {processMap.get(code) || code}
                      </span>
                    ))
                  ) : (
                    <span className="text-neutral-600 italic">—</span>
                  )}
                </div>
              </div>
              {/* Regulator */}
              <div className="flex items-start justify-between gap-2">
                <span className="text-neutral-500 shrink-0 w-24">Regulator</span>
                <div className="flex flex-wrap gap-1 justify-end">
                  {regulatorCodes.length > 0 ? (
                    regulatorCodes.map((code) => (
                      <span key={code} className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-300">
                        {regulatorMap.get(code) || code}
                      </span>
                    ))
                  ) : (
                    <span className="text-neutral-600 italic">—</span>
                  )}
                </div>
              </div>
              {/* Regulation */}
              <div className="flex items-start justify-between gap-2">
                <span className="text-neutral-500 shrink-0 w-24">Regulation</span>
                <div className="flex flex-wrap gap-1 justify-end">
                  {regulationCodes.length > 0 ? (
                    regulationCodes.map((code) => (
                      <span
                        key={code}
                        className="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-300"
                      >
                        {regulationMap.get(code) || code}
                      </span>
                    ))
                  ) : (
                    <span className="text-neutral-600 italic">—</span>
                  )}
                </div>
              </div>
              {/* Vendor */}
              <div className="flex items-start justify-between gap-2">
                <span className="text-neutral-500 shrink-0 w-24">Vendor</span>
                <div className="flex flex-wrap gap-1 justify-end">
                  {vendorNames.length > 0 ? (
                    vendorNames.map((name, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300">
                        {name}
                      </span>
                    ))
                  ) : (
                    <span className="text-neutral-600 italic">—</span>
                  )}
                </div>
              </div>
              {/* BFSI Organization */}
              <div className="flex items-start justify-between gap-2">
                <span className="text-neutral-500 shrink-0 w-24">Organization</span>
                <div className="flex flex-wrap gap-1 justify-end">
                  {organizationNames.length > 0 ? (
                    organizationNames.map((name, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded bg-pink-500/10 text-pink-300">
                        {name}
                      </span>
                    ))
                  ) : (
                    <span className="text-neutral-600 italic">—</span>
                  )}
                </div>
              </div>
              {/* Persona */}
              <div className="flex items-start justify-between gap-2">
                <span className="text-neutral-500 shrink-0 w-24">Persona</span>
                <div className="flex flex-wrap gap-1 justify-end">
                  {personaScores.executive ||
                  personaScores.technical ||
                  personaScores.compliance ? (
                    <>
                      {personaScores.executive && personaScores.executive >= 0.5 && (
                        <span className="px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-300">
                          Executive ({(personaScores.executive * 100).toFixed(0)}%)
                        </span>
                      )}
                      {personaScores.technical && personaScores.technical >= 0.5 && (
                        <span className="px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-300">
                          Technical ({(personaScores.technical * 100).toFixed(0)}%)
                        </span>
                      )}
                      {personaScores.compliance && personaScores.compliance >= 0.5 && (
                        <span className="px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-300">
                          Compliance ({(personaScores.compliance * 100).toFixed(0)}%)
                        </span>
                      )}
                      {!personaScores.executive || personaScores.executive < 0.5 ? null : null}
                      {(!personaScores.executive || personaScores.executive < 0.5) &&
                        (!personaScores.technical || personaScores.technical < 0.5) &&
                        (!personaScores.compliance || personaScores.compliance < 0.5) && (
                          <span className="text-neutral-600 italic">—</span>
                        )}
                    </>
                  ) : (
                    <span className="text-neutral-600 italic">—</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
