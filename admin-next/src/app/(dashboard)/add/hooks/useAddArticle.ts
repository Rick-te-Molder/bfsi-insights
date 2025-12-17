'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { MissedDiscovery } from '@bfsi/types';
import type { SubmissionStatus, InputMode } from '../types';

export function useAddArticle() {
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

  // KB-280: Fetch missed_discovery and ingestion_queue separately, then merge
  const loadMissedItems = useCallback(async () => {
    setLoadingList(true);
    const { data: missedData, error: missedError } = await supabase
      .from('missed_discovery')
      .select(
        `id, url, source_domain, submitter_name, submitter_audience, submitter_channel, 
         why_valuable, submitter_urgency, resolution_status, submitted_at, existing_source_slug,
         queue_id`,
      )
      .order('submitted_at', { ascending: false })
      .limit(100);

    if (missedError) {
      console.error('Failed to load missed items:', missedError);
      setLoadingList(false);
      return;
    }

    const queueIds =
      missedData?.map((item) => item.queue_id).filter((id): id is string => id !== null) || [];
    let queueMap: Record<string, { status_code: number; payload: Record<string, unknown> | null }> =
      {};

    if (queueIds.length > 0) {
      const { data: queueData } = await supabase
        .from('ingestion_queue')
        .select('id, status_code, payload')
        .in('id', queueIds);
      if (queueData) {
        queueMap = Object.fromEntries(
          queueData.map((q) => [q.id, { status_code: q.status_code, payload: q.payload }]),
        );
      }
    }

    const mergedData =
      missedData?.map((item) => ({
        ...item,
        ingestion_queue:
          item.queue_id && queueMap[item.queue_id] ? [queueMap[item.queue_id]] : null,
      })) || [];

    setMissedItems(mergedData);
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
          setExistingSource(data?.[0]?.name || data?.[0]?.slug || null);
        });
    } catch {
      setDetectedDomain(null);
      setExistingSource(null);
    }
  }, [url, supabase]);

  const resetForm = () => {
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
    resetForm();
    setSubmitterChannel('');
    setSubmitterUrgency('');
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

  return {
    activeTab,
    setActiveTab,
    missedItems,
    loadingList,
    loadMissedItems,
    inputMode,
    setInputMode,
    url,
    setUrl,
    pdfFile,
    setPdfFile,
    pdfTitle,
    setPdfTitle,
    uploadProgress,
    setUploadProgress,
    submitterName,
    setSubmitterName,
    submitterAudience,
    setSubmitterAudience,
    submitterChannel,
    setSubmitterChannel,
    submitterUrgency,
    setSubmitterUrgency,
    whyValuable,
    setWhyValuable,
    verbatimComment,
    setVerbatimComment,
    suggestedAudiences,
    toggleAudience,
    status,
    setStatus,
    message,
    setMessage,
    detectedDomain,
    existingSource,
    editingId,
    setEditingId,
    resetForm,
    editItem,
    cancelEdit,
    deleteItem,
    supabase,
  };
}
