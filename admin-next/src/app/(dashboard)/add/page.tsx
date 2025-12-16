'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

type SubmissionStatus = 'idle' | 'submitting' | 'uploading' | 'success' | 'error';
type InputMode = 'url' | 'pdf';

interface MissedDiscovery {
  id: string;
  url: string;
  source_domain: string;
  submitter_name: string | null;
  submitter_audience: string | null;
  submitter_channel: string | null;
  why_valuable: string | null;
  submitter_urgency: string | null;
  resolution_status: string;
  submitted_at: string;
  existing_source_slug: string | null;
}

const AUDIENCES = [
  { value: 'executive', label: 'Executive', description: 'C-suite, Board, VP' },
  {
    value: 'functional_specialist',
    label: 'Functional Specialist',
    description: 'Risk, Compliance, Finance',
  },
  { value: 'engineer', label: 'Engineer', description: 'IT, Dev, Data' },
  { value: 'researcher', label: 'Researcher', description: 'Analyst, Academic' },
];

const CHANNELS = [
  { value: 'email', label: 'Email' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'signal', label: 'Signal' },
  { value: 'slack', label: 'Slack' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'other', label: 'Other' },
];

const URGENCY_OPTIONS = [
  { value: 'fyi', label: 'FYI', color: 'text-neutral-400' },
  { value: 'important', label: 'Important', color: 'text-amber-400' },
  { value: 'critical', label: 'Critical', color: 'text-red-400' },
];

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
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wide">
                  The Article
                </h2>
                <div className="flex rounded-lg border border-neutral-700 p-0.5">
                  <button
                    type="button"
                    onClick={() => setInputMode('url')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      inputMode === 'url'
                        ? 'bg-sky-600 text-white'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    🔗 URL
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode('pdf')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      inputMode === 'pdf'
                        ? 'bg-sky-600 text-white'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    📄 PDF
                  </button>
                </div>
              </div>

              {inputMode === 'url' ? (
                <div>
                  <label htmlFor="url" className="block text-sm font-medium text-neutral-300 mb-2">
                    URL <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="url"
                    id="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/article"
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3 text-white placeholder-neutral-500 focus:border-sky-500 focus:outline-none"
                  />
                  {detectedDomain && (
                    <p className="mt-2 text-sm">
                      {existingSource ? (
                        <span className="text-amber-400">
                          ⚠️ We track <strong>{existingSource}</strong> — why did we miss this?
                        </span>
                      ) : (
                        <span className="text-sky-400">
                          ⚡ New domain: <strong>{detectedDomain}</strong> (not tracked)
                        </span>
                      )}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor="pdfTitle"
                      className="block text-sm font-medium text-neutral-300 mb-2"
                    >
                      Title <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      id="pdfTitle"
                      value={pdfTitle}
                      onChange={(e) => setPdfTitle(e.target.value)}
                      placeholder="e.g., ECB Working Paper on Inflation"
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3 text-white placeholder-neutral-500 focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-2">
                      PDF File <span className="text-red-400">*</span>
                    </label>
                    <div
                      className={`relative rounded-lg border-2 border-dashed transition-colors ${
                        pdfFile
                          ? 'border-emerald-500/50 bg-emerald-500/10'
                          : 'border-neutral-700 hover:border-neutral-600'
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const file = e.dataTransfer.files[0];
                        if (file?.type === 'application/pdf') {
                          setPdfFile(file);
                          if (!pdfTitle) setPdfTitle(file.name.replace('.pdf', ''));
                        }
                      }}
                    >
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setPdfFile(file);
                            if (!pdfTitle) setPdfTitle(file.name.replace('.pdf', ''));
                          }
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="p-6 text-center">
                        {pdfFile ? (
                          <div className="space-y-2">
                            <p className="text-emerald-400">📄 {pdfFile.name}</p>
                            <p className="text-xs text-neutral-500">
                              {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPdfFile(null);
                              }}
                              className="text-xs text-red-400 hover:text-red-300"
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-neutral-400">
                              📎 Drop PDF here or <span className="text-sky-400">browse</span>
                            </p>
                            <p className="text-xs text-neutral-500">Max 50MB</p>
                          </div>
                        )}
                      </div>
                    </div>
                    {status === 'uploading' && (
                      <div className="mt-2">
                        <div className="h-1 rounded-full bg-neutral-700 overflow-hidden">
                          <div
                            className="h-full bg-sky-500 transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                        <p className="text-xs text-neutral-500 mt-1">
                          Uploading... {uploadProgress}%
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 space-y-4">
              <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wide">
                Who Sent This?
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Name / Company <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={submitterName}
                    onChange={(e) => setSubmitterName(e.target.value)}
                    placeholder="John Smith, Acme Corp"
                    required
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-white placeholder-neutral-500 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Channel <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={submitterChannel}
                    onChange={(e) => setSubmitterChannel(e.target.value)}
                    required
                    className={`w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 focus:border-sky-500 focus:outline-none ${submitterChannel ? 'text-white' : 'text-neutral-500'}`}
                  >
                    <option value="" disabled>
                      Select channel...
                    </option>
                    {CHANNELS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Their Role / Audience <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {AUDIENCES.map((aud) => (
                    <button
                      key={aud.value}
                      type="button"
                      onClick={() => setSubmitterAudience(aud.value)}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        submitterAudience === aud.value
                          ? 'border-sky-500 bg-sky-500/20 text-white'
                          : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-600'
                      }`}
                    >
                      <div className="font-medium">{aud.label}</div>
                      <div className="text-xs text-neutral-500">{aud.description}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Urgency <span className="text-red-400">*</span>
                </label>
                <div className="flex gap-2">
                  {URGENCY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSubmitterUrgency(opt.value)}
                      className={`px-4 py-2 rounded-lg border transition-colors ${
                        submitterUrgency === opt.value
                          ? 'border-sky-500 bg-sky-500/20'
                          : 'border-neutral-700 bg-neutral-800 hover:border-neutral-600'
                      } ${opt.color}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-4">
              <h2 className="text-sm font-semibold text-amber-300 uppercase tracking-wide">
                ⭐ Why Was This Valuable?
              </h2>
              <p className="text-xs text-neutral-400">
                This is the most important field — it helps us understand what we&apos;re missing
              </p>
              <div>
                <label htmlFor="why" className="block text-sm font-medium text-neutral-300 mb-2">
                  Why did they send this? What makes it valuable?{' '}
                  <span className="text-red-400">*</span>
                </label>
                <textarea
                  id="why"
                  value={whyValuable}
                  onChange={(e) => setWhyValuable(e.target.value)}
                  required
                  rows={3}
                  placeholder="Board meeting next week on this topic... Client said 'this is exactly what we needed'..."
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3 text-white placeholder-neutral-500 focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Their exact words (optional)
                </label>
                <input
                  type="text"
                  value={verbatimComment}
                  onChange={(e) => setVerbatimComment(e.target.value)}
                  placeholder='"This is the kind of content that makes us look smart"'
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-white placeholder-neutral-500 focus:border-sky-500 focus:outline-none"
                />
              </div>
              <div className="text-xs text-neutral-500 space-y-1">
                <p className="font-medium">💡 Examples that help us learn:</p>
                <ul className="ml-4 space-y-0.5">
                  <li>• &quot;Board asked about this exact topic last week&quot;</li>
                  <li>• &quot;This is what our risk team has been searching for&quot;</li>
                  <li>• &quot;Competitor mentioned this, we need to know too&quot;</li>
                </ul>
              </div>
            </div>

            <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 space-y-4">
              <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wide">
                Classification (Optional)
              </h2>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Who should see this?
                </label>
                <div className="flex flex-wrap gap-2">
                  {AUDIENCES.map((aud) => (
                    <button
                      key={aud.value}
                      type="button"
                      onClick={() => toggleAudience(aud.value)}
                      className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                        suggestedAudiences.includes(aud.value)
                          ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
                          : 'bg-neutral-800 text-neutral-400 border border-neutral-700 hover:border-neutral-600'
                      }`}
                    >
                      {aud.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

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
        <div>
          {loadingList ? (
            <div className="p-8 text-center text-neutral-500">Loading...</div>
          ) : missedItems.length === 0 ? (
            <div className="p-8 text-center text-neutral-500">No articles added yet</div>
          ) : (
            <div className="space-y-3">
              {missedItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-400 hover:underline text-sm font-medium"
                    >
                      {item.source_domain}
                    </a>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-xs ${
                          item.submitter_urgency === 'critical'
                            ? 'text-red-400'
                            : item.submitter_urgency === 'important'
                              ? 'text-amber-400'
                              : 'text-neutral-400'
                        }`}
                      >
                        {item.submitter_urgency || '—'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          item.resolution_status === 'pending'
                            ? 'bg-neutral-700 text-neutral-300'
                            : item.resolution_status === 'source_added'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-sky-500/20 text-sky-300'
                        }`}
                      >
                        {item.resolution_status}
                      </span>
                    </div>
                  </div>
                  {item.why_valuable && (
                    <p className="text-sm text-neutral-300 line-clamp-2">{item.why_valuable}</p>
                  )}
                  <div className="flex items-center justify-between text-xs text-neutral-500">
                    <span>
                      {item.submitter_name || 'Anonymous'}
                      {item.submitter_audience && (
                        <span className="ml-1 capitalize">
                          · {item.submitter_audience.replace('_', ' ')}
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-3">
                      <span>{new Date(item.submitted_at).toLocaleDateString()}</span>
                      <button
                        onClick={() => editItem(item)}
                        className="text-sky-400 hover:text-sky-300"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
