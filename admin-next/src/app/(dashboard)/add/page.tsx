'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import type { MissedDiscovery } from '@bfsi/types';
import type { SubmissionStatus, InputMode } from './types';
import { ArticleInput, SubmitterInfo, WhyValuable, MissedItemsList } from './components';

export default function AddArticlePage() {
  const [activeTab, setActiveTab] = useState<'add' | 'list'>('add');
  const [missedItems, setMissedItems] = useState<MissedDiscovery[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const [inputMode, setInputMode] = useState<InputMode>('url');
  const [url, setUrl] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfTitle, setPdfTitle] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitterName, setSubmitterName] = useState('');
  const [submitterAudience, setSubmitterAudience] = useState('');
  const [submitterChannel, setSubmitterChannel] = useState('');
  const [submitterUrgency, setSubmitterUrgency] = useState('');
  const [whyValuable, setWhyValuable] = useState('');
  const [verbatimComment, setVerbatimComment] = useState('');
  const [suggestedAudiences, setSuggestedAudiences] = useState<string[]>([]);

  const [status, setStatus] = useState<SubmissionStatus>('idle');
  const [message, setMessage] = useState('');
  const [detectedDomain, setDetectedDomain] = useState<string | null>(null);
  const [existingSource, setExistingSource] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const supabase = createClient();

  const loadMissedItems = useCallback(async () => {
    setLoadingList(true);
    const { data, error } = await supabase
      .from('missed_discovery')
      .select(
        'id, url, source_domain, submitter_name, submitter_audience, submitter_channel, why_valuable, submitter_urgency, resolution_status, submitted_at, existing_source_slug',
      )
      .order('submitted_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      setMissedItems(data);
    }
    setLoadingList(false);
  }, [supabase]);

  useEffect(() => {
    if (activeTab === 'list') {
      loadMissedItems();
    }
  }, [activeTab, loadMissedItems]);

  useEffect(() => {
    if (!url) {
      setDetectedDomain(null);
      setExistingSource(null);
      return;
    }

    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace(/^www\./, '');
      setDetectedDomain(domain);

      supabase
        .from('kb_source')
        .select('slug, name')
        .ilike('domain', `%${domain}%`)
        .limit(1)
        .then(({ data }) => {
          if (data && data.length > 0) {
            setExistingSource(data[0].name || data[0].slug);
          } else {
            setExistingSource(null);
          }
        });
    } catch {
      setDetectedDomain(null);
      setExistingSource(null);
    }
  }, [url, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate based on input mode
    if (inputMode === 'url' && !url.trim()) {
      setStatus('error');
      setMessage('Please enter a URL');
      return;
    }

    if (inputMode === 'pdf' && !pdfFile) {
      setStatus('error');
      setMessage('Please select a PDF file');
      return;
    }

    if (inputMode === 'pdf' && !pdfTitle.trim()) {
      setStatus('error');
      setMessage('Please enter a title for the PDF');
      return;
    }

    if (!submitterName.trim()) {
      setStatus('error');
      setMessage('Please enter the submitter name/company');
      return;
    }

    if (!whyValuable.trim()) {
      setStatus('error');
      setMessage('Please explain why this article was valuable');
      return;
    }

    if (!submitterAudience) {
      setStatus('error');
      setMessage("Please select the submitter's audience/role");
      return;
    }

    if (!submitterChannel) {
      setStatus('error');
      setMessage('Please select the channel');
      return;
    }

    if (!submitterUrgency) {
      setStatus('error');
      setMessage('Please select the urgency level');
      return;
    }

    setStatus('submitting');
    setMessage('');

    try {
      let finalUrl = url.trim();
      let domain = '';
      let urlNorm = '';

      // Handle PDF upload
      if (inputMode === 'pdf' && pdfFile) {
        setStatus('uploading');
        setUploadProgress(0);

        const fileId = crypto.randomUUID();
        const filePath = `pdfs/${fileId}.pdf`;

        const { error: uploadError } = await supabase.storage
          .from('asset')
          .upload(filePath, pdfFile, {
            contentType: 'application/pdf',
            upsert: false,
          });

        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

        setUploadProgress(100);

        const {
          data: { publicUrl },
        } = supabase.storage.from('asset').getPublicUrl(filePath);
        finalUrl = publicUrl;
        domain = 'manual-pdf-upload';
        urlNorm = publicUrl.toLowerCase();

        setStatus('submitting');
      } else {
        const urlObj = new URL(url);
        urlNorm = (urlObj.origin + urlObj.pathname).toLowerCase();
        domain = urlObj.hostname.replace(/^www\./, '');
      }

      if (editingId) {
        // Update existing item
        const { error } = await supabase
          .from('missed_discovery')
          .update({
            submitter_name: submitterName.trim() || null,
            submitter_audience: submitterAudience,
            submitter_channel: submitterChannel,
            submitter_urgency: submitterUrgency,
            why_valuable: whyValuable.trim(),
            verbatim_comment: verbatimComment.trim() || null,
            suggested_audiences: suggestedAudiences.length > 0 ? suggestedAudiences : null,
          })
          .eq('id', editingId);

        if (error) throw error;

        setStatus('success');
        setMessage('Article updated successfully!');
        setEditingId(null);
        loadMissedItems();
      } else {
        // Check for duplicates only on new submissions
        const { data: existing } = await supabase
          .from('missed_discovery')
          .select('id')
          .eq('url_norm', urlNorm)
          .maybeSingle();

        if (existing) {
          setStatus('error');
          setMessage('This URL has already been reported');
          return;
        }

        const { error } = await supabase.from('missed_discovery').insert({
          url: finalUrl,
          url_norm: urlNorm,
          submitter_name: submitterName.trim() || null,
          submitter_type: 'client',
          submitter_audience: submitterAudience,
          submitter_channel: submitterChannel,
          submitter_urgency: submitterUrgency,
          why_valuable: whyValuable.trim(),
          verbatim_comment: verbatimComment.trim() || null,
          suggested_audiences: suggestedAudiences.length > 0 ? suggestedAudiences : null,
          source_domain: domain,
          existing_source_slug: existingSource,
        });

        if (error) throw error;

        const isPdf = inputMode === 'pdf';
        const { error: queueError } = await supabase.from('ingestion_queue').insert({
          url: finalUrl,
          status: 'pending',
          status_code: isPdf ? 230 : 200, // PDFs skip to thumbnailing (230), URLs start at pending_enrichment (200)
          entry_type: 'manual',
          payload: {
            manual_add: true,
            title: isPdf ? pdfTitle.trim() : null,
            is_pdf: isPdf,
            submitter: submitterName.trim() || null,
            why_valuable: whyValuable.trim(),
            source: existingSource || null,
          },
        });

        if (queueError) {
          console.error('Failed to add to ingestion queue:', queueError);
        }

        setStatus('success');
        setMessage(
          isPdf
            ? 'PDF uploaded! It will be processed and available for review.'
            : 'Article submitted! It will be processed AND help improve our discovery.',
        );
      }

      setInputMode('url');
      setUrl('');
      setPdfFile(null);
      setPdfTitle('');
      setUploadProgress(0);
      setSubmitterName('');
      setSubmitterAudience('');
      setWhyValuable('');
      setVerbatimComment('');
      setSuggestedAudiences([]);
      setDetectedDomain(null);
      setExistingSource(null);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Failed to submit');
    }
  };

  const toggleAudience = (audience: string) => {
    setSuggestedAudiences((prev) =>
      prev.includes(audience) ? prev.filter((a) => a !== audience) : [...prev, audience],
    );
  };

  const editItem = (item: MissedDiscovery) => {
    setEditingId(item.id);
    setUrl(item.url);
    setSubmitterName(item.submitter_name || '');
    setSubmitterAudience(item.submitter_audience || '');
    setSubmitterChannel(item.submitter_channel || '');
    setSubmitterUrgency(item.submitter_urgency || '');
    setWhyValuable(item.why_valuable || '');
    setDetectedDomain(item.source_domain);
    setExistingSource(item.existing_source_slug);
    setActiveTab('add');
    setStatus('idle');
    setMessage('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setUrl('');
    setSubmitterName('');
    setSubmitterAudience('');
    setSubmitterChannel('');
    setSubmitterUrgency('');
    setWhyValuable('');
    setVerbatimComment('');
    setSuggestedAudiences([]);
    setDetectedDomain(null);
    setExistingSource(null);
    setStatus('idle');
    setMessage('');
  };

  const deleteItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this article?')) return;
    const { error } = await supabase.from('missed_discovery').delete().eq('id', id);
    if (!error) {
      setMissedItems((prev) => prev.filter((item) => item.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Add Article</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Submit articles we missed — they&apos;ll be processed AND help improve our discovery
        </p>
      </header>

      <div className="flex gap-6 border-b border-neutral-800">
        <button
          onClick={() => setActiveTab('add')}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'add'
              ? 'border-sky-500 text-white'
              : 'border-transparent text-neutral-400 hover:text-white'
          }`}
        >
          ➕ Add Article
        </button>
        <button
          onClick={() => setActiveTab('list')}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'list'
              ? 'border-sky-500 text-white'
              : 'border-transparent text-neutral-400 hover:text-white'
          }`}
        >
          📋 History ({missedItems.length || '...'})
        </button>
      </div>

      {activeTab === 'add' ? (
        <div className="max-w-2xl">
          {editingId && (
            <div className="mb-4 flex items-center justify-between rounded-lg border border-sky-500/20 bg-sky-500/10 p-3">
              <span className="text-sky-300">✏️ Editing article</span>
              <button
                type="button"
                onClick={cancelEdit}
                className="text-sm text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          )}
          {status === 'success' && (
            <div className="mb-6 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
              <p className="text-emerald-300">✅ {message}</p>
            </div>
          )}
          {status === 'error' && (
            <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-4">
              <p className="text-red-300">❌ {message}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <ArticleInput
              inputMode={inputMode}
              setInputMode={setInputMode}
              url={url}
              setUrl={setUrl}
              pdfFile={pdfFile}
              setPdfFile={setPdfFile}
              pdfTitle={pdfTitle}
              setPdfTitle={setPdfTitle}
              detectedDomain={detectedDomain}
              existingSource={existingSource}
              status={status}
              uploadProgress={uploadProgress}
            />

            <SubmitterInfo
              submitterName={submitterName}
              setSubmitterName={setSubmitterName}
              submitterChannel={submitterChannel}
              setSubmitterChannel={setSubmitterChannel}
              submitterAudience={submitterAudience}
              setSubmitterAudience={setSubmitterAudience}
              submitterUrgency={submitterUrgency}
              setSubmitterUrgency={setSubmitterUrgency}
            />

            <WhyValuable
              whyValuable={whyValuable}
              setWhyValuable={setWhyValuable}
              verbatimComment={verbatimComment}
              setVerbatimComment={setVerbatimComment}
              suggestedAudiences={suggestedAudiences}
              toggleAudience={toggleAudience}
            />

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={status === 'submitting' || status === 'uploading'}
                className="rounded-lg bg-sky-600 px-6 py-3 font-medium text-white hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'uploading'
                  ? 'Uploading PDF...'
                  : status === 'submitting'
                    ? 'Submitting...'
                    : editingId
                      ? 'Update Article'
                      : inputMode === 'pdf'
                        ? 'Upload PDF'
                        : 'Add Article'}
              </button>
              <Link
                href="/review"
                className="rounded-lg border border-neutral-700 px-6 py-3 font-medium text-neutral-300 hover:bg-neutral-800"
              >
                Go to Review Queue
              </Link>
            </div>
          </form>
        </div>
      ) : (
        <MissedItemsList
          items={missedItems}
          loading={loadingList}
          onEdit={editItem}
          onDelete={deleteItem}
        />
      )}
    </div>
  );
}
