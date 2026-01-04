'use client';

import type { EvalGoldenSet } from '@/types/database';

interface GoldenSetsListProps {
  filteredSets: EvalGoldenSet[];
  setSelectedItem: (item: EvalGoldenSet) => void;
  handleDelete: (id: string) => void;
}

function GoldenSetsEmpty() {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-12 text-center">
      <p className="text-neutral-400">No golden set items yet</p>
      <p className="text-sm text-neutral-600 mt-1">
        Add curated test cases with expected outputs to evaluate agents
      </p>
    </div>
  );
}

function GoldenSetsItem({
  item,
  setSelectedItem,
  handleDelete,
}: Readonly<{
  item: EvalGoldenSet;
  setSelectedItem: (item: EvalGoldenSet) => void;
  handleDelete: (id: string) => void;
}>) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 hover:border-neutral-700 transition-colors">
      <GoldenSetsItemContent item={item} />
      <GoldenSetsItemActions
        item={item}
        setSelectedItem={setSelectedItem}
        handleDelete={handleDelete}
      />
      <GoldenSetsItemFooter item={item} />
    </div>
  );
}

function GoldenSetsItemContent({ item }: Readonly<{ item: EvalGoldenSet }>) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <GoldenSetsItemHeader item={item} />
        {item.description && <p className="text-sm text-neutral-400 mb-2">{item.description}</p>}
        <GoldenSetsItemData item={item} />
      </div>
    </div>
  );
}

function GoldenSetsItemHeader({ item }: Readonly<{ item: EvalGoldenSet }>) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="rounded-full bg-sky-500/20 text-sky-300 px-2 py-0.5 text-xs">
        {item.agent_name}
      </span>
      <span className="font-medium text-white">{item.name}</span>
    </div>
  );
}

function GoldenSetsItemData({ item }: Readonly<{ item: EvalGoldenSet }>) {
  return (
    <div className="grid grid-cols-2 gap-4 text-xs">
      <div>
        <span className="text-neutral-500">Input:</span>
        <pre className="mt-1 p-2 rounded bg-neutral-800/50 text-neutral-300 overflow-auto max-h-24">
          {JSON.stringify(item.input, null, 2).slice(0, 200)}
          {JSON.stringify(item.input).length > 200 && '...'}
        </pre>
      </div>
      <div>
        <span className="text-neutral-500">Expected Output:</span>
        <pre className="mt-1 p-2 rounded bg-emerald-500/10 text-emerald-300 overflow-auto max-h-24">
          {JSON.stringify(item.expected_output, null, 2).slice(0, 200)}
          {JSON.stringify(item.expected_output).length > 200 && '...'}
        </pre>
      </div>
    </div>
  );
}

function GoldenSetsItemActions({
  item,
  setSelectedItem,
  handleDelete,
}: Readonly<{
  item: EvalGoldenSet;
  setSelectedItem: (item: EvalGoldenSet) => void;
  handleDelete: (id: string) => void;
}>) {
  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={() => setSelectedItem(item)}
        className="text-sky-400 hover:text-sky-300 text-sm"
      >
        View
      </button>
      <button
        onClick={() => handleDelete(item.id)}
        className="text-red-400 hover:text-red-300 text-sm"
      >
        Delete
      </button>
    </div>
  );
}

function GoldenSetsItemFooter({ item }: Readonly<{ item: EvalGoldenSet }>) {
  return (
    <div className="mt-2 text-xs text-neutral-500">
      Added {new Date(item.created_at).toLocaleDateString()}
      {item.created_by && ` by ${item.created_by}`}
    </div>
  );
}

export function GoldenSetsList({
  filteredSets,
  setSelectedItem,
  handleDelete,
}: Readonly<GoldenSetsListProps>) {
  if (filteredSets.length === 0) {
    return <GoldenSetsEmpty />;
  }

  return (
    <div className="space-y-3">
      {filteredSets.map((item) => (
        <GoldenSetsItem
          key={item.id}
          item={item}
          setSelectedItem={setSelectedItem}
          handleDelete={handleDelete}
        />
      ))}
    </div>
  );
}
