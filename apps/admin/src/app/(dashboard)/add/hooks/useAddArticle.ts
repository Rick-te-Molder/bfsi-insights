'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { MissedDiscovery } from '@bfsi/types';
import type { SubmissionStatus, InputMode } from '../types';
import { useMissedItems } from './useMissedItems';
import { useDetectedSource } from './useDetectedSource';

function useTabsState() {
  const [activeTab, setActiveTab] = useState<'add' | 'list'>('add');
  return { activeTab, setActiveTab };
}

function useInputState() {
  const [inputMode, setInputMode] = useState<InputMode>('url');
  const [url, setUrl] = useState('');
  return { inputMode, setInputMode, url, setUrl };
}

function usePdfState() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfTitle, setPdfTitle] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  return { pdfFile, setPdfFile, pdfTitle, setPdfTitle, uploadProgress, setUploadProgress };
}

function useSubmitterState() {
  const [submitterName, setSubmitterName] = useState('');
  const [submitterAudience, setSubmitterAudience] = useState('');
  const [submitterChannel, setSubmitterChannel] = useState('');
  const [submitterUrgency, setSubmitterUrgency] = useState('');
  return {
    submitterName,
    setSubmitterName,
    submitterAudience,
    setSubmitterAudience,
    submitterChannel,
    setSubmitterChannel,
    submitterUrgency,
    setSubmitterUrgency,
  };
}

function useCommentState() {
  const [whyValuable, setWhyValuable] = useState('');
  const [verbatimComment, setVerbatimComment] = useState('');
  return { whyValuable, setWhyValuable, verbatimComment, setVerbatimComment };
}

function useSuggestedAudiencesState() {
  const [suggestedAudiences, setSuggestedAudiences] = useState<string[]>([]);
  return { suggestedAudiences, setSuggestedAudiences };
}

type AddArticleFormState = ReturnType<typeof useInputState> &
  ReturnType<typeof usePdfState> &
  ReturnType<typeof useSubmitterState> &
  ReturnType<typeof useCommentState> &
  ReturnType<typeof useSuggestedAudiencesState>;

function useSubmissionState() {
  const [status, setStatus] = useState<SubmissionStatus>('idle');
  const [message, setMessage] = useState('');
  return { status, setStatus, message, setMessage };
}

function useEditingState() {
  const [editingId, setEditingId] = useState<string | null>(null);
  return { editingId, setEditingId };
}

function useResetForm(opts: {
  setInputMode: (mode: InputMode) => void;
  setUrl: (value: string) => void;
  setPdfFile: (file: File | null) => void;
  setPdfTitle: (value: string) => void;
  setUploadProgress: (value: number) => void;
  setSubmitterName: (value: string) => void;
  setSubmitterAudience: (value: string) => void;
  setWhyValuable: (value: string) => void;
  setVerbatimComment: (value: string) => void;
  setSuggestedAudiences: (value: string[]) => void;
}) {
  return () => {
    opts.setInputMode('url');
    opts.setUrl('');
    opts.setPdfFile(null);
    opts.setPdfTitle('');
    opts.setUploadProgress(0);
    opts.setSubmitterName('');
    opts.setSubmitterAudience('');
    opts.setWhyValuable('');
    opts.setVerbatimComment('');
    opts.setSuggestedAudiences([]);
  };
}

function useAudienceToggle(opts: {
  setSuggestedAudiences: (updater: (prev: string[]) => string[]) => void;
}) {
  return (audience: string) => {
    opts.setSuggestedAudiences((prev) =>
      prev.includes(audience) ? prev.filter((a) => a !== audience) : [...prev, audience],
    );
  };
}

function useEditActions(opts: {
  setEditingId: (id: string | null) => void;
  setUrl: (value: string) => void;
  setSubmitterName: (value: string) => void;
  setSubmitterAudience: (value: string) => void;
  setSubmitterChannel: (value: string) => void;
  setSubmitterUrgency: (value: string) => void;
  setWhyValuable: (value: string) => void;
  setActiveTab: (value: 'add' | 'list') => void;
  setStatus: (value: SubmissionStatus) => void;
  setMessage: (value: string) => void;
  resetForm: () => void;
}) {
  const editItem = useEditItem(opts);
  const cancelEdit = useCancelEdit(opts);
  return { editItem, cancelEdit };
}

function useEditItem(opts: {
  setEditingId: (id: string | null) => void;
  setUrl: (value: string) => void;
  setSubmitterName: (value: string) => void;
  setSubmitterAudience: (value: string) => void;
  setSubmitterChannel: (value: string) => void;
  setSubmitterUrgency: (value: string) => void;
  setWhyValuable: (value: string) => void;
  setActiveTab: (value: 'add' | 'list') => void;
  setStatus: (value: SubmissionStatus) => void;
  setMessage: (value: string) => void;
}) {
  return (item: MissedDiscovery) => {
    opts.setEditingId(item.id);
    opts.setUrl(item.url);
    opts.setSubmitterName(item.submitter_name || '');
    opts.setSubmitterAudience(item.submitter_audience || '');
    opts.setSubmitterChannel(item.submitter_channel || '');
    opts.setSubmitterUrgency(item.submitter_urgency || '');
    opts.setWhyValuable(item.why_valuable || '');
    opts.setActiveTab('add');
    opts.setStatus('idle');
    opts.setMessage('');
  };
}

function useCancelEdit(opts: {
  setEditingId: (id: string | null) => void;
  resetForm: () => void;
  setSubmitterChannel: (value: string) => void;
  setSubmitterUrgency: (value: string) => void;
  setStatus: (value: SubmissionStatus) => void;
  setMessage: (value: string) => void;
}) {
  return () => {
    opts.setEditingId(null);
    opts.resetForm();
    opts.setSubmitterChannel('');
    opts.setSubmitterUrgency('');
    opts.setStatus('idle');
    opts.setMessage('');
  };
}

function useAddArticleBase() {
  const tabs = useTabsState();
  const input = useInputState();
  const pdf = usePdfState();
  const submitter = useSubmitterState();
  const comments = useCommentState();
  const suggested = useSuggestedAudiencesState();
  const form: AddArticleFormState = { ...input, ...pdf, ...submitter, ...comments, ...suggested };
  const submission = useSubmissionState();
  const editing = useEditingState();

  const supabase = createClient();
  const missed = useMissedItems({ active: tabs.activeTab === 'list' });
  const detected = useDetectedSource(form.url);

  return { tabs, form, submission, editing, supabase, missed, detected };
}

function useAddArticleResetActions(form: AddArticleFormState) {
  const resetForm = useResetForm({
    setInputMode: form.setInputMode,
    setUrl: form.setUrl,
    setPdfFile: form.setPdfFile,
    setPdfTitle: form.setPdfTitle,
    setUploadProgress: form.setUploadProgress,
    setSubmitterName: form.setSubmitterName,
    setSubmitterAudience: form.setSubmitterAudience,
    setWhyValuable: form.setWhyValuable,
    setVerbatimComment: form.setVerbatimComment,
    setSuggestedAudiences: form.setSuggestedAudiences,
  });
  const toggleAudience = useAudienceToggle({ setSuggestedAudiences: form.setSuggestedAudiences });
  return { resetForm, toggleAudience };
}

function useAddArticleEditActions(opts: {
  tabs: ReturnType<typeof useTabsState>;
  form: AddArticleFormState;
  submission: ReturnType<typeof useSubmissionState>;
  editing: ReturnType<typeof useEditingState>;
  resetForm: () => void;
}) {
  return useEditActions({
    setEditingId: opts.editing.setEditingId,
    setUrl: opts.form.setUrl,
    setSubmitterName: opts.form.setSubmitterName,
    setSubmitterAudience: opts.form.setSubmitterAudience,
    setSubmitterChannel: opts.form.setSubmitterChannel,
    setSubmitterUrgency: opts.form.setSubmitterUrgency,
    setWhyValuable: opts.form.setWhyValuable,
    setActiveTab: opts.tabs.setActiveTab,
    setStatus: opts.submission.setStatus,
    setMessage: opts.submission.setMessage,
    resetForm: opts.resetForm,
  });
}

function useAddArticleModel() {
  const base = useAddArticleBase();
  const resetActions = useAddArticleResetActions(base.form);
  const editActions = useAddArticleEditActions({
    tabs: base.tabs,
    form: base.form,
    submission: base.submission,
    editing: base.editing,
    resetForm: resetActions.resetForm,
  });

  return {
    ...base.tabs,
    ...base.missed,
    ...base.form,
    ...resetActions,
    ...base.submission,
    ...base.detected,
    ...base.editing,
    ...editActions,
    supabase: base.supabase,
  };
}

export function useAddArticle() {
  return useAddArticleModel();
}
