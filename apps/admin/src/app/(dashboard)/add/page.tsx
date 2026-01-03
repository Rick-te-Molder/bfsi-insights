'use client';

import Link from 'next/link';
import { useAddArticle } from './hooks';
import { ArticleInput, SubmitterInfo, WhyValuable, MissedItemsList } from './components';
import { validateForm } from './handlers/validateForm';
import { submitArticle } from './handlers/submitArticle';

export default function AddArticlePage() {
  const {
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
  } = useAddArticle();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validateForm({
      inputMode,
      url,
      pdfFile,
      pdfTitle,
      submitterName,
      whyValuable,
      submitterAudience,
      submitterChannel,
      submitterUrgency,
    });

    if (!validation.valid) {
      setStatus('error');
      setMessage(validation.error!);
      return;
    }

    await submitArticle({
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
    });
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
          className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === 'add' ? 'border-sky-500 text-white' : 'border-transparent text-neutral-400 hover:text-white'}`}
        >
          ➕ Add Article
        </button>
        <button
          onClick={() => setActiveTab('list')}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === 'list' ? 'border-sky-500 text-white' : 'border-transparent text-neutral-400 hover:text-white'}`}
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
                href="/items"
                className="rounded-lg border border-neutral-700 px-6 py-3 font-medium text-neutral-300 hover:bg-neutral-800"
              >
                Go to Items Queue
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
