import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import type { SubmissionStatus } from '../types';
import { AUDIENCES, CHANNELS, URGENCY_OPTIONS } from '../constants';

interface MissedFormProps {
  onSuccess: () => void;
}

export function MissedForm({ onSuccess }: MissedFormProps) {
  const [url, setUrl] = useState('');
  const [submitterName, setSubmitterName] = useState('');
  const [submitterAudience, setSubmitterAudience] = useState('');
  const [submitterChannel, setSubmitterChannel] = useState('email');
  const [submitterUrgency, setSubmitterUrgency] = useState('important');
  const [whyValuable, setWhyValuable] = useState('');
  const [verbatimComment, setVerbatimComment] = useState('');
  const [suggestedAudiences, setSuggestedAudiences] = useState<string[]>([]);
  const [status, setStatus] = useState<SubmissionStatus>('idle');
  const [message, setMessage] = useState('');
  const [detectedDomain, setDetectedDomain] = useState<string | null>(null);
  const [existingSource, setExistingSource] = useState<string | null>(null);

  const supabase = createClient();

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

    if (!url.trim()) {
      setStatus('error');
      setMessage('Please enter a URL');
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

    setStatus('submitting');
    setMessage('');

    try {
      const urlObj = new URL(url);
      const urlNorm = (urlObj.origin + urlObj.pathname).toLowerCase();
      const domain = urlObj.hostname.replace(/^www\./, '');

      const { data: existing } = await supabase
        .from('missed_discovery')
        .select('id')
        .eq('url_norm', urlNorm)
        .maybeSingle();

      if (existing) {
        setStatus('error');
        setMessage('This URL has already been reported as missed');
        return;
      }

      const { error } = await supabase.from('missed_discovery').insert({
        url: url.trim(),
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

      const { error: queueError } = await supabase.from('ingestion_queue').insert({
        url: url.trim(),
        url_norm: urlNorm,
        source: existingSource || 'manual',
        status: 'pending',
        status_code: 200,
        payload: {
          manual_add: true,
          submitter: submitterName.trim() || null,
          why_valuable: whyValuable.trim(),
        },
      });

      if (queueError) {
        console.error('Failed to add to ingestion queue:', queueError);
      }

      setStatus('success');
      setMessage('Article submitted! It will be processed AND help improve our discovery.');

      setUrl('');
      setSubmitterName('');
      setSubmitterAudience('');
      setWhyValuable('');
      setVerbatimComment('');
      setSuggestedAudiences([]);
      setDetectedDomain(null);
      setExistingSource(null);
      onSuccess();
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

  return (
    <div className="max-w-2xl">
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
          <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wide">
            The Article
          </h2>

          <div>
            <label htmlFor="url" className="block text-sm font-medium text-neutral-300 mb-2">
              URL <span className="text-red-400">*</span>
            </label>
            <input
              type="url"
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
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
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 space-y-4">
          <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wide">
            Who Sent This?
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Name / Company
              </label>
              <input
                type="text"
                value={submitterName}
                onChange={(e) => setSubmitterName(e.target.value)}
                placeholder="John Smith, Acme Corp"
                className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-white placeholder-neutral-500 focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Channel</label>
              <select
                value={submitterChannel}
                onChange={(e) => setSubmitterChannel(e.target.value)}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-white focus:border-sky-500 focus:outline-none"
              >
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
            <label className="block text-sm font-medium text-neutral-300 mb-2">Urgency</label>
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
            disabled={status === 'submitting'}
            className="rounded-lg bg-sky-600 px-6 py-3 font-medium text-white hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === 'submitting' ? 'Submitting...' : 'Report Missed Article'}
          </button>
          <Link
            href="/items"
            className="rounded-lg border border-neutral-700 px-6 py-3 font-medium text-neutral-300 hover:bg-neutral-800"
          >
            Go to Items Queue
          </Link>
        </div>
      </form>
    </div>
  );
}
