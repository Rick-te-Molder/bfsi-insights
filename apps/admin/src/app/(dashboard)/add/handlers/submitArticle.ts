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

type SubmitCtx = SubmitArticleParams;

async function uploadPdfAndGetUrl(
  supabase: SupabaseClient,
  pdfFile: File,
  setUploadProgress: (progress: number) => void,
) {
  setUploadProgress(0);
  const fileId = crypto.randomUUID();
  const filePath = `pdfs/${fileId}.pdf`;
  const { error: uploadError } = await supabase.storage.from('asset').upload(filePath, pdfFile, {
    contentType: 'application/pdf',
    upsert: false,
  });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
  setUploadProgress(100);

  const {
    data: { publicUrl },
  } = supabase.storage.from('asset').getPublicUrl(filePath);
  return publicUrl;
}

function normalizeUrlAndDomain(inputUrl: string) {
  const urlObj = new URL(inputUrl);
  const urlNorm = (urlObj.origin + urlObj.pathname).toLowerCase();
  const domain = urlObj.hostname.replace(/^www\./, '');
  return { urlNorm, domain };
}

function getSuggestedAudiencesValue(suggestedAudiences: string[]) {
  return suggestedAudiences.length > 0 ? suggestedAudiences : null;
}

function trimOrNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

async function updateMissedDiscovery(ctx: SubmitCtx) {
  const { error } = await ctx.supabase
    .from('missed_discovery')
    .update({
      submitter_name: trimOrNull(ctx.submitterName),
      submitter_audience: ctx.submitterAudience,
      submitter_channel: ctx.submitterChannel,
      submitter_urgency: ctx.submitterUrgency,
      why_valuable: ctx.whyValuable.trim(),
      verbatim_comment: trimOrNull(ctx.verbatimComment),
      suggested_audiences: getSuggestedAudiencesValue(ctx.suggestedAudiences),
    })
    .eq('id', ctx.editingId);
  if (error) throw error;
}

async function insertQueueItem(ctx: SubmitCtx, finalUrl: string) {
  const isPdf = ctx.inputMode === 'pdf';
  const { data: queueItem, error: queueError } = await ctx.supabase
    .from('ingestion_queue')
    .insert({
      url: finalUrl,
      status_code: isPdf ? 230 : 200,
      entry_type: 'manual',
      payload: {
        manual_add: true,
        title: isPdf ? ctx.pdfTitle.trim() : null,
        is_pdf: isPdf,
        submitter: trimOrNull(ctx.submitterName),
        why_valuable: ctx.whyValuable.trim(),
        source: ctx.existingSource || null,
      },
    })
    .select('id')
    .single();
  if (queueError) throw queueError;
  return { queueId: queueItem.id, isPdf };
}

function buildMissedDiscoveryInsert(
  ctx: SubmitCtx,
  urlInfo: { finalUrl: string; urlNorm: string; domain: string },
  queueId: string,
) {
  return {
    url: urlInfo.finalUrl,
    url_norm: urlInfo.urlNorm,
    queue_id: queueId,
    submitter_name: trimOrNull(ctx.submitterName),
    submitter_type: 'client',
    submitter_audience: ctx.submitterAudience,
    submitter_channel: ctx.submitterChannel,
    submitter_urgency: ctx.submitterUrgency,
    why_valuable: ctx.whyValuable.trim(),
    verbatim_comment: trimOrNull(ctx.verbatimComment),
    suggested_audiences: getSuggestedAudiencesValue(ctx.suggestedAudiences),
    source_domain: urlInfo.domain,
    existing_source_slug: ctx.existingSource,
  };
}

async function insertMissedDiscovery(
  ctx: SubmitCtx,
  urlInfo: { finalUrl: string; urlNorm: string; domain: string },
  queueId: string,
) {
  const { error } = await ctx.supabase.from('missed_discovery').insert({
    ...buildMissedDiscoveryInsert(ctx, urlInfo, queueId),
  });
  return error;
}

async function triggerManualProcessing(queueId: string) {
  await fetch('/api/process-manual', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ queueId }),
  });
}

async function resolveUrlInfo(ctx: SubmitCtx) {
  const finalUrlSeed = ctx.url.trim();
  if (ctx.inputMode === 'pdf' && ctx.pdfFile) {
    ctx.setStatus('uploading');
    const finalUrl = await uploadPdfAndGetUrl(ctx.supabase, ctx.pdfFile, ctx.setUploadProgress);
    ctx.setStatus('submitting');
    return { finalUrl, domain: 'manual-pdf-upload', urlNorm: finalUrl.toLowerCase() };
  }

  const normalized = normalizeUrlAndDomain(finalUrlSeed);
  return { finalUrl: finalUrlSeed, domain: normalized.domain, urlNorm: normalized.urlNorm };
}

async function ensureUrlNotAlreadyReported(ctx: SubmitCtx, urlNorm: string) {
  const { data: existing } = await ctx.supabase
    .from('missed_discovery')
    .select('id')
    .eq('url_norm', urlNorm)
    .maybeSingle();
  if (existing) throw new Error('This URL has already been reported');
}

async function submitUpdate(ctx: SubmitCtx) {
  await updateMissedDiscovery(ctx);
  ctx.setStatus('success');
  ctx.setMessage('Article updated successfully!');
  ctx.setEditingId(null);
  ctx.loadMissedItems();
  ctx.resetForm();
}

function getPdfSuccessMessage() {
  return 'PDF uploaded! Processing started - check History tab for progress.';
}

function getArticleSuccessMessage() {
  return 'Article submitted! Processing started - check History tab for progress.';
}

async function submitCreate(
  ctx: SubmitCtx,
  urlInfo: { finalUrl: string; urlNorm: string; domain: string },
) {
  await ensureUrlNotAlreadyReported(ctx, urlInfo.urlNorm);

  const { queueId, isPdf } = await insertQueueItem(ctx, urlInfo.finalUrl);
  const insertError = await insertMissedDiscovery(ctx, urlInfo, queueId);
  if (insertError) console.error('Failed to add to missed_discovery:', insertError);

  try {
    await triggerManualProcessing(queueId);
  } catch (error_) {
    console.error('Failed to trigger enrichment:', error_);
  }

  ctx.setStatus('success');
  ctx.setMessage(isPdf ? getPdfSuccessMessage() : getArticleSuccessMessage());
  ctx.resetForm();
}

export async function submitArticle(ctx: SubmitArticleParams) {
  ctx.setStatus('submitting');
  ctx.setMessage('');

  try {
    const urlInfo = await resolveUrlInfo(ctx);
    if (ctx.editingId) await submitUpdate(ctx);
    else await submitCreate(ctx, urlInfo);
  } catch (err) {
    ctx.setStatus('error');
    ctx.setMessage(err instanceof Error ? err.message : 'Failed to submit');
  }
}
