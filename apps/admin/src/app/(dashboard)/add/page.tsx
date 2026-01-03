'use client';

import Link from 'next/link';
import type { FormEventHandler } from 'react';
import { useAddArticle } from './hooks';
import { ArticleInput, SubmitterInfo, WhyValuable, MissedItemsList } from './components';
import { validateForm } from './handlers/validateForm';
import { submitArticle } from './handlers/submitArticle';

function getSubmitLabel(state: {
  status: string;
  editingId: string | null;
  inputMode: 'url' | 'pdf';
}) {
  if (state.status === 'uploading') return 'Uploading PDF...';
  if (state.status === 'submitting') return 'Submitting...';
  if (state.editingId) return 'Update Article';
  if (state.inputMode === 'pdf') return 'Upload PDF';
  return 'Add Article';
}

function buildValidationInput(state: ReturnType<typeof useAddArticle>) {
  return {
    inputMode: state.inputMode,
    url: state.url,
    pdfFile: state.pdfFile,
    pdfTitle: state.pdfTitle,
    submitterName: state.submitterName,
    whyValuable: state.whyValuable,
    submitterAudience: state.submitterAudience,
    submitterChannel: state.submitterChannel,
    submitterUrgency: state.submitterUrgency,
  };
}

function isValidOrSetError(state: ReturnType<typeof useAddArticle>) {
  const validation = validateForm(buildValidationInput(state));
  if (validation.valid) return true;
  state.setStatus('error');
  state.setMessage(validation.error!);
  return false;
}

function buildSubmitParams(state: ReturnType<typeof useAddArticle>) {
  return {
    inputMode: state.inputMode,
    url: state.url,
    pdfFile: state.pdfFile,
    pdfTitle: state.pdfTitle,
    submitterName: state.submitterName,
    submitterAudience: state.submitterAudience,
    submitterChannel: state.submitterChannel,
    submitterUrgency: state.submitterUrgency,
    whyValuable: state.whyValuable,
    verbatimComment: state.verbatimComment,
    suggestedAudiences: state.suggestedAudiences,
    existingSource: state.existingSource,
    editingId: state.editingId,
    supabase: state.supabase,
    setStatus: state.setStatus,
    setMessage: state.setMessage,
    setUploadProgress: state.setUploadProgress,
    setEditingId: state.setEditingId,
    loadMissedItems: state.loadMissedItems,
    resetForm: state.resetForm,
  };
}

async function runSubmit(state: ReturnType<typeof useAddArticle>) {
  if (!isValidOrSetError(state)) return;
  await submitArticle(buildSubmitParams(state));
}

function StatusBanner(state: { status: string; message: string }) {
  if (state.status === 'success') {
    return (
      <div className="mb-6 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
        <p className="text-emerald-300">✅ {state.message}</p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-4">
        <p className="text-red-300">❌ {state.message}</p>
      </div>
    );
  }

  return null;
}

function Tabs(state: {
  activeTab: string;
  setActiveTab: (tab: 'add' | 'list') => void;
  missedItemsLength: number;
}) {
  return (
    <div className="flex gap-6 border-b border-neutral-800">
      <button
        onClick={() => state.setActiveTab('add')}
        className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${state.activeTab === 'add' ? 'border-sky-500 text-white' : 'border-transparent text-neutral-400 hover:text-white'}`}
      >
        ➕ Add Article
      </button>
      <button
        onClick={() => state.setActiveTab('list')}
        className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${state.activeTab === 'list' ? 'border-sky-500 text-white' : 'border-transparent text-neutral-400 hover:text-white'}`}
      >
        📋 History ({state.missedItemsLength || '...'})
      </button>
    </div>
  );
}

function EditingBanner(state: { editingId: string | null; cancelEdit: () => void }) {
  if (!state.editingId) return null;
  return (
    <div className="mb-4 flex items-center justify-between rounded-lg border border-sky-500/20 bg-sky-500/10 p-3">
      <span className="text-sky-300">✏️ Editing article</span>
      <button
        type="button"
        onClick={state.cancelEdit}
        className="text-sm text-neutral-400 hover:text-white"
      >
        Cancel
      </button>
    </div>
  );
}

function SubmitActions(state: { status: string; submitLabel: string }) {
  return (
    <div className="flex gap-3">
      <button
        type="submit"
        disabled={state.status === 'submitting' || state.status === 'uploading'}
        className="rounded-lg bg-sky-600 px-6 py-3 font-medium text-white hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {state.submitLabel}
      </button>
      <Link
        href="/items"
        className="rounded-lg border border-neutral-700 px-6 py-3 font-medium text-neutral-300 hover:bg-neutral-800"
      >
        Go to Items Queue
      </Link>
    </div>
  );
}

function ArticleSection(state: ReturnType<typeof useAddArticle>) {
  return (
    <ArticleInput
      inputMode={state.inputMode}
      setInputMode={state.setInputMode}
      url={state.url}
      setUrl={state.setUrl}
      pdfFile={state.pdfFile}
      setPdfFile={state.setPdfFile}
      pdfTitle={state.pdfTitle}
      setPdfTitle={state.setPdfTitle}
      detectedDomain={state.detectedDomain}
      existingSource={state.existingSource}
      status={state.status}
      uploadProgress={state.uploadProgress}
    />
  );
}

function SubmitterSection(state: ReturnType<typeof useAddArticle>) {
  return (
    <SubmitterInfo
      submitterName={state.submitterName}
      setSubmitterName={state.setSubmitterName}
      submitterChannel={state.submitterChannel}
      setSubmitterChannel={state.setSubmitterChannel}
      submitterAudience={state.submitterAudience}
      setSubmitterAudience={state.setSubmitterAudience}
      submitterUrgency={state.submitterUrgency}
      setSubmitterUrgency={state.setSubmitterUrgency}
    />
  );
}

function WhyValuableSection(state: ReturnType<typeof useAddArticle>) {
  return (
    <WhyValuable
      whyValuable={state.whyValuable}
      setWhyValuable={state.setWhyValuable}
      verbatimComment={state.verbatimComment}
      setVerbatimComment={state.setVerbatimComment}
      suggestedAudiences={state.suggestedAudiences}
      toggleAudience={state.toggleAudience}
    />
  );
}

function AddFormFields(state: ReturnType<typeof useAddArticle>) {
  return (
    <>
      <ArticleSection {...state} />
      <SubmitterSection {...state} />
      <WhyValuableSection {...state} />
    </>
  );
}

function AddTab(
  state: ReturnType<typeof useAddArticle> & { onSubmit: FormEventHandler<HTMLFormElement> },
) {
  const submitLabel = getSubmitLabel(state);
  return (
    <div className="max-w-2xl">
      <EditingBanner editingId={state.editingId} cancelEdit={state.cancelEdit} />
      <StatusBanner status={state.status} message={state.message} />
      <form onSubmit={state.onSubmit} className="space-y-6">
        <AddFormFields {...state} />
        <SubmitActions status={state.status} submitLabel={submitLabel} />
      </form>
    </div>
  );
}

function Content(
  state: ReturnType<typeof useAddArticle> & { onSubmit: FormEventHandler<HTMLFormElement> },
) {
  return state.activeTab === 'add' ? (
    <AddTab {...state} onSubmit={state.onSubmit} />
  ) : (
    <MissedItemsList
      items={state.missedItems}
      loading={state.loadingList}
      onEdit={state.editItem}
      onDelete={state.deleteItem}
    />
  );
}

export default function AddArticlePage() {
  const state = useAddArticle();
  const handleSubmit: FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    void runSubmit(state);
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Add Article</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Submit articles we missed — they&apos;ll be processed AND help improve our discovery
        </p>
      </header>

      <Tabs
        activeTab={state.activeTab}
        setActiveTab={state.setActiveTab}
        missedItemsLength={state.missedItems.length}
      />

      <Content {...state} onSubmit={handleSubmit} />
    </div>
  );
}
