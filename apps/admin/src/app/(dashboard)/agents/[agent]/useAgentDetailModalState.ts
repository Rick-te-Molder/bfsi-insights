'use client';

import { useState } from 'react';
import type { PromptVersion } from '@/types/database';

type ModalSetters = {
  setEditingPrompt: (value: PromptVersion | null) => void;
  setCreatingNewVersion: (value: PromptVersion | null) => void;
  setTestingPrompt: (value: PromptVersion | null) => void;
  setDiffMode: (value: { a: PromptVersion; b: PromptVersion } | null) => void;
};

function buildClosers(setters: ModalSetters) {
  const closeEdit = () => setters.setEditingPrompt(null);
  const closeCreate = () => setters.setCreatingNewVersion(null);
  const closeTest = () => setters.setTestingPrompt(null);
  const closeDiff = () => setters.setDiffMode(null);
  return { closeEdit, closeCreate, closeTest, closeDiff };
}

function buildModalApi(args: {
  editingPrompt: PromptVersion | null;
  creatingNewVersion: PromptVersion | null;
  testingPrompt: PromptVersion | null;
  diffMode: { a: PromptVersion; b: PromptVersion } | null;
  setEditingPrompt: (value: PromptVersion | null) => void;
  setCreatingNewVersion: (value: PromptVersion | null) => void;
  setTestingPrompt: (value: PromptVersion | null) => void;
  setDiffMode: (value: { a: PromptVersion; b: PromptVersion } | null) => void;
  closers: ReturnType<typeof buildClosers>;
  onSaved: () => void;
}) {
  return {
    editingPrompt: args.editingPrompt,
    creatingNewVersion: args.creatingNewVersion,
    testingPrompt: args.testingPrompt,
    diffMode: args.diffMode,
    setEditingPrompt: args.setEditingPrompt,
    setCreatingNewVersion: args.setCreatingNewVersion,
    setTestingPrompt: args.setTestingPrompt,
    setDiffMode: args.setDiffMode,
    closeEdit: args.closers.closeEdit,
    closeCreate: args.closers.closeCreate,
    closeTest: args.closers.closeTest,
    closeDiff: args.closers.closeDiff,
    onSaved: args.onSaved,
  };
}

function useModalState() {
  const [editingPrompt, setEditingPrompt] = useState<PromptVersion | null>(null);
  const [creatingNewVersion, setCreatingNewVersion] = useState<PromptVersion | null>(null);
  const [testingPrompt, setTestingPrompt] = useState<PromptVersion | null>(null);
  const [diffMode, setDiffMode] = useState<{ a: PromptVersion; b: PromptVersion } | null>(null);
  return {
    editingPrompt,
    creatingNewVersion,
    testingPrompt,
    diffMode,
    setEditingPrompt,
    setCreatingNewVersion,
    setTestingPrompt,
    setDiffMode,
  };
}

function createOnSaved(closers: ReturnType<typeof buildClosers>, loadPrompts: () => void) {
  return () => {
    closers.closeEdit();
    closers.closeCreate();
    loadPrompts();
  };
}

export function useAgentDetailModalState(loadPrompts: () => void) {
  const state = useModalState();
  const closers = buildClosers({
    setEditingPrompt: state.setEditingPrompt,
    setCreatingNewVersion: state.setCreatingNewVersion,
    setTestingPrompt: state.setTestingPrompt,
    setDiffMode: state.setDiffMode,
  });
  const onSaved = createOnSaved(closers, loadPrompts);
  return buildModalApi({
    editingPrompt: state.editingPrompt,
    creatingNewVersion: state.creatingNewVersion,
    testingPrompt: state.testingPrompt,
    diffMode: state.diffMode,
    setEditingPrompt: state.setEditingPrompt,
    setCreatingNewVersion: state.setCreatingNewVersion,
    setTestingPrompt: state.setTestingPrompt,
    setDiffMode: state.setDiffMode,
    closers,
    onSaved,
  });
}
