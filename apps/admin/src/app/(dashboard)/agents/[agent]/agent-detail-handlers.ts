import type { PromptVersion } from '@/types/database';

function toOptionalVersion(version: PromptVersion | null | undefined): PromptVersion | undefined {
  if (!version) return undefined;
  return version;
}

function toNullableVersion(version: PromptVersion | null | undefined): PromptVersion | null {
  if (!version) return null;
  return version;
}

function normalizeArgs(
  selectedVersion: PromptVersion | null | undefined,
  currentPrompt: PromptVersion | null | undefined,
) {
  return {
    selected: toNullableVersion(selectedVersion),
    current: toOptionalVersion(currentPrompt),
  };
}

function createDeleteHandler(
  selected: PromptVersion | null,
  deleteVersion: (p: PromptVersion) => void | Promise<void>,
) {
  return () => {
    if (selected) {
      deleteVersion(selected);
    }
  };
}

function createCompareHandler(
  current: PromptVersion | undefined,
  selected: PromptVersion | null,
  setDiffMode: (value: { a: PromptVersion; b: PromptVersion } | null) => void,
) {
  return () => {
    if (!current || !selected) return;
    setDiffMode({ a: current, b: selected });
  };
}

function createPromoteHandler(
  selected: PromptVersion | null,
  promoteVersion: (p: PromptVersion) => void | Promise<void>,
) {
  return () => {
    if (!selected) return;
    promoteVersion(selected);
  };
}

export function createAgentDetailHandlers(args: {
  selectedVersion: PromptVersion | null | undefined;
  currentPrompt: PromptVersion | null | undefined;
  deleteVersion: (p: PromptVersion) => void | Promise<void>;
  promoteVersion: (p: PromptVersion) => void | Promise<void>;
  setTestingPrompt: (p: PromptVersion | null) => void;
  setEditingPrompt: (p: PromptVersion | null) => void;
  setCreatingNewVersion: (p: PromptVersion | null) => void;
  setDiffMode: (value: { a: PromptVersion; b: PromptVersion } | null) => void;
}) {
  const normalized = normalizeArgs(args.selectedVersion, args.currentPrompt);
  const onTest = () => args.setTestingPrompt(normalized.selected);
  const onEdit = () => args.setEditingPrompt(normalized.selected);
  const onCreateNew = () => args.setCreatingNewVersion(normalized.selected);
  const onDelete = createDeleteHandler(normalized.selected, args.deleteVersion);
  const onCompare = createCompareHandler(normalized.current, normalized.selected, args.setDiffMode);
  const onPromote = createPromoteHandler(normalized.selected, args.promoteVersion);
  return { onTest, onEdit, onCreateNew, onDelete, onCompare, onPromote };
}
