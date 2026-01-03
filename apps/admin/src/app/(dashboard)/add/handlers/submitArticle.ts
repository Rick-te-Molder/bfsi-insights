import type { SupabaseClient } from '@supabase/supabase-js';

interface SubmitArticleParams {
  inputMode: 'url' | 'pdf';
  url: string;
  pdfFile: File | null;
  pdfTitle: string;
  submitterName: string;
  submitterAudience: string;
  submitterChannel: string;
  submitterUrgency: string;
  whyValuable: string;
  verbatimComment: string;
  suggestedAudiences: string[];
  existingSource: string | null;
  editingId: string | null;
  supabase: SupabaseClient;
  setStatus: (status: 'idle' | 'submitting' | 'uploading' | 'success' | 'error') => void;
  setMessage: (message: string) => void;
  setUploadProgress: (progress: number) => void;
  setEditingId: (id: string | null) => void;
  loadMissedItems: () => void;
  resetForm: () => void;
}

export async function submitArticle(params: SubmitArticleParams) {
  const {
    inputMode,
    url,
    pdfFile,
    pdfTitle,
    submitterName,
    submitterAudience,
    submitterChannel,
    submitterUrgency,
    whyValuable,
    verbatimComment,
    suggestedAudiences,
    existingSource,
    editingId,
    supabase,
    setStatus,
    setMessage,
    setUploadProgress,
    setEditingId,
    loadMissedItems,
    resetForm,
  } = params;

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

      const isPdf = inputMode === 'pdf';
      const { data: queueItem, error: queueError } = await supabase
        .from('ingestion_queue')
        .insert({
          url: finalUrl,
          status_code: isPdf ? 230 : 200,
          entry_type: 'manual',
          payload: {
            manual_add: true,
            title: isPdf ? pdfTitle.trim() : null,
            is_pdf: isPdf,
            submitter: submitterName.trim() || null,
            why_valuable: whyValuable.trim(),
            source: existingSource || null,
          },
        })
        .select('id')
        .single();
      if (queueError) throw queueError;

      const { error } = await supabase.from('missed_discovery').insert({
        url: finalUrl,
        url_norm: urlNorm,
        queue_id: queueItem.id,
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
      if (error) console.error('Failed to add to missed_discovery:', error);

      try {
        await fetch('/api/process-manual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ queueId: queueItem.id }),
        });
      } catch (triggerErr) {
        console.error('Failed to trigger enrichment:', triggerErr);
      }

      setStatus('success');
      setMessage(
        isPdf
          ? 'PDF uploaded! Processing started - check History tab for progress.'
          : 'Article submitted! Processing started - check History tab for progress.',
      );
    }

    resetForm();
  } catch (err) {
    setStatus('error');
    setMessage(err instanceof Error ? err.message : 'Failed to submit');
  }
}
