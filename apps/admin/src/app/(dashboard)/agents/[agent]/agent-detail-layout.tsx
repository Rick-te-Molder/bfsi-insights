'use client';

import type { PromptVersion } from '@/types/database';
import { AgentHeader } from './components/AgentHeader';
import { VersionList } from './components/VersionList';
import { PromptDisplay } from './components/PromptDisplay';

function toOptionalVersion(version: PromptVersion | null | undefined): PromptVersion | undefined {
  if (!version) return undefined;
  return version;
}

function toNullableVersion(version: PromptVersion | null | undefined): PromptVersion | null {
  if (!version) return null;
  return version;
}

type AgentDetailBodyProps = {
  prompts: PromptVersion[];
  selectedVersion: PromptVersion | null;
  currentPrompt: PromptVersion | undefined;
  onSelect: (version: PromptVersion) => void;
  onPromote: () => void;
  onCompare: () => void;
};

function AgentDetailBody({
  prompts,
  selectedVersion,
  currentPrompt,
  onSelect,
  onPromote,
  onCompare,
}: Readonly<AgentDetailBodyProps>) {
  return (
    <div className="flex-1 min-h-0 flex gap-4">
      <VersionList prompts={prompts} selectedVersion={selectedVersion} onSelect={onSelect} />

      <PromptDisplay
        version={selectedVersion}
        currentPrompt={currentPrompt}
        onPromote={onPromote}
        onCompare={onCompare}
      />
    </div>
  );
}

type AgentHeaderSectionProps = {
  agentName: string;
  prompts: PromptVersion[];
  currentPrompt: PromptVersion | undefined;
  selectedVersion: PromptVersion | null;
  onTest: () => void;
  onEdit: () => void;
  onCreateNew: () => void;
  onDelete: () => void;
};

function AgentHeaderSection({
  agentName,
  prompts,
  currentPrompt,
  selectedVersion,
  onTest,
  onEdit,
  onCreateNew,
  onDelete,
}: Readonly<AgentHeaderSectionProps>) {
  return (
    <AgentHeader
      agentName={agentName}
      prompts={prompts}
      currentPrompt={currentPrompt}
      selectedVersion={selectedVersion}
      onTest={onTest}
      onEdit={onEdit}
      onCreateNew={onCreateNew}
      onDelete={onDelete}
    />
  );
}

type AgentDetailLayoutProps = {
  agentName: string;
  prompts: PromptVersion[];
  currentPrompt: PromptVersion | null | undefined;
  selectedVersion: PromptVersion | null | undefined;
  onTest: () => void;
  onEdit: () => void;
  onCreateNew: () => void;
  onDelete: () => void;
  onSelect: (version: PromptVersion) => void;
  onPromote: () => void;
  onCompare: () => void;
  children: React.ReactNode;
};

function AgentDetailHeaderBlock({
  agentName,
  prompts,
  current,
  selected,
  onTest,
  onEdit,
  onCreateNew,
  onDelete,
}: Readonly<
  Pick<
    AgentDetailLayoutFrameProps,
    | 'agentName'
    | 'prompts'
    | 'current'
    | 'selected'
    | 'onTest'
    | 'onEdit'
    | 'onCreateNew'
    | 'onDelete'
  >
>) {
  return (
    <AgentHeaderSection
      agentName={agentName}
      prompts={prompts}
      currentPrompt={current}
      selectedVersion={selected}
      onTest={onTest}
      onEdit={onEdit}
      onCreateNew={onCreateNew}
      onDelete={onDelete}
    />
  );
}

function AgentDetailBodyBlock({
  prompts,
  current,
  selected,
  onSelect,
  onPromote,
  onCompare,
}: Readonly<
  Pick<
    AgentDetailLayoutFrameProps,
    'prompts' | 'current' | 'selected' | 'onSelect' | 'onPromote' | 'onCompare'
  >
>) {
  return (
    <AgentDetailBody
      prompts={prompts}
      selectedVersion={selected}
      currentPrompt={current}
      onSelect={onSelect}
      onPromote={onPromote}
      onCompare={onCompare}
    />
  );
}

type NormalizedVersions = {
  current: PromptVersion | undefined;
  selected: PromptVersion | null;
};

function normalizeVersions(
  currentPrompt: PromptVersion | null | undefined,
  selectedVersion: PromptVersion | null | undefined,
): NormalizedVersions {
  return {
    current: toOptionalVersion(currentPrompt),
    selected: toNullableVersion(selectedVersion),
  };
}

type AgentDetailLayoutFrameProps = {
  agentName: string;
  prompts: PromptVersion[];
  current: PromptVersion | undefined;
  selected: PromptVersion | null;
  onTest: () => void;
  onEdit: () => void;
  onCreateNew: () => void;
  onDelete: () => void;
  onSelect: (version: PromptVersion) => void;
  onPromote: () => void;
  onCompare: () => void;
  children: React.ReactNode;
};

function buildFrameProps(args: {
  agentName: string;
  prompts: PromptVersion[];
  versions: NormalizedVersions;
  onTest: () => void;
  onEdit: () => void;
  onCreateNew: () => void;
  onDelete: () => void;
  onSelect: (version: PromptVersion) => void;
  onPromote: () => void;
  onCompare: () => void;
  children: React.ReactNode;
}): AgentDetailLayoutFrameProps {
  return {
    agentName: args.agentName,
    prompts: args.prompts,
    current: args.versions.current,
    selected: args.versions.selected,
    onTest: args.onTest,
    onEdit: args.onEdit,
    onCreateNew: args.onCreateNew,
    onDelete: args.onDelete,
    onSelect: args.onSelect,
    onPromote: args.onPromote,
    onCompare: args.onCompare,
    children: args.children,
  };
}

function AgentDetailLayoutFrame(props: Readonly<AgentDetailLayoutFrameProps>) {
  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      <AgentDetailHeaderBlock
        agentName={props.agentName}
        prompts={props.prompts}
        current={props.current}
        selected={props.selected}
        onTest={props.onTest}
        onEdit={props.onEdit}
        onCreateNew={props.onCreateNew}
        onDelete={props.onDelete}
      />

      <AgentDetailBodyBlock
        prompts={props.prompts}
        current={props.current}
        selected={props.selected}
        onSelect={props.onSelect}
        onPromote={props.onPromote}
        onCompare={props.onCompare}
      />

      {props.children}
    </div>
  );
}

export function AgentDetailLayout({
  agentName,
  prompts,
  currentPrompt,
  selectedVersion,
  onTest,
  onEdit,
  onCreateNew,
  onDelete,
  onSelect,
  onPromote,
  onCompare,
  children,
}: Readonly<AgentDetailLayoutProps>) {
  const versions = normalizeVersions(currentPrompt, selectedVersion);
  const frameProps = buildFrameProps({
    agentName,
    prompts,
    versions,
    onTest,
    onEdit,
    onCreateNew,
    onDelete,
    onSelect,
    onPromote,
    onCompare,
    children,
  });
  return <AgentDetailLayoutFrame {...frameProps} />;
}
