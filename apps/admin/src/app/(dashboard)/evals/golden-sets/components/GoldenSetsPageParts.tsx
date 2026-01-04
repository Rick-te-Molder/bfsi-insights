'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/client';
import type { EvalGoldenSet } from '@/types/database';

import { CreateGoldenSetModal as CreateModal } from './CreateGoldenSetModal';
import { GoldenSetsHeader } from './GoldenSetsHeader';
import { GoldenSetsList } from './GoldenSetsList';
import { ViewGoldenSetModal as ViewModal } from './ViewGoldenSetModal';

type GoldenSetsState = {
  goldenSets: EvalGoldenSet[];
  loading: boolean;
  showCreateModal: boolean;
  selectedItem: EvalGoldenSet | null;
  filterAgent: string;
  setGoldenSets: (v: EvalGoldenSet[]) => void;
  setLoading: (v: boolean) => void;
  setShowCreateModal: (v: boolean) => void;
  setSelectedItem: (v: EvalGoldenSet | null) => void;
  setFilterAgent: (v: string) => void;
};

function useGoldenSetsState(): GoldenSetsState {
  const [goldenSets, setGoldenSets] = useState<EvalGoldenSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<EvalGoldenSet | null>(null);
  const [filterAgent, setFilterAgent] = useState('all');

  return {
    goldenSets,
    loading,
    showCreateModal,
    selectedItem,
    filterAgent,
    setGoldenSets,
    setLoading,
    setShowCreateModal,
    setSelectedItem,
    setFilterAgent,
  };
}

function useGoldenSetsDerived(goldenSets: EvalGoldenSet[], filterAgent: string) {
  return useMemo(() => {
    const agents = [...new Set(goldenSets.map((g) => g.agent_name))];
    const filteredSets =
      filterAgent === 'all' ? goldenSets : goldenSets.filter((g) => g.agent_name === filterAgent);

    return { agents, filteredSets };
  }, [filterAgent, goldenSets]);
}

function useLoadGoldenSets(supabase: SupabaseClient, state: GoldenSetsState) {
  return useCallback(async () => {
    state.setLoading(true);

    const { data, error } = await supabase
      .from('eval_golden_set')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error) state.setGoldenSets(data || []);
    state.setLoading(false);
  }, [state, supabase]);
}

function useDeleteGoldenSet({
  supabase,
  loadData,
}: {
  supabase: SupabaseClient;
  loadData: () => Promise<void>;
}) {
  return useCallback(
    async (id: string) => {
      if (!confirm('Delete this golden set item?')) return;

      const { error } = await supabase.from('eval_golden_set').delete().eq('id', id);
      if (error) {
        alert('Failed to delete: ' + error.message);
        return;
      }

      await loadData();
    },
    [loadData, supabase],
  );
}

function GoldenSetsPageLoading() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-neutral-400">Loading golden sets...</div>
    </div>
  );
}

function GoldenSetsPageHeader({
  agentsCount,
  filterAgent,
  goldenSetsCount,
  onAddClick,
  setFilterAgent,
}: Readonly<{
  agentsCount: number;
  filterAgent: string;
  goldenSetsCount: number;
  onAddClick: () => void;
  setFilterAgent: (v: string) => void;
}>) {
  return (
    <GoldenSetsHeader
      goldenSetsCount={goldenSetsCount}
      agentsCount={agentsCount}
      filterAgent={filterAgent}
      setFilterAgent={setFilterAgent}
      onAddClick={onAddClick}
    />
  );
}

function GoldenSetsPageBody({
  filteredSets,
  handleDelete,
  setSelectedItem,
}: Readonly<{
  filteredSets: EvalGoldenSet[];
  handleDelete: (id: string) => void | Promise<void>;
  setSelectedItem: (v: EvalGoldenSet | null) => void;
}>) {
  return (
    <GoldenSetsList
      filteredSets={filteredSets}
      setSelectedItem={setSelectedItem}
      handleDelete={handleDelete}
    />
  );
}

function GoldenSetsPageModals({
  loadData,
  onCloseCreate,
  onCloseView,
  selectedItem,
  showCreateModal,
}: Readonly<{
  loadData: () => Promise<void>;
  onCloseCreate: () => void;
  onCloseView: () => void;
  selectedItem: EvalGoldenSet | null;
  showCreateModal: boolean;
}>) {
  return (
    <>
      {showCreateModal && <CreateModal onClose={onCloseCreate} onCreated={loadData} />}
      {selectedItem && <ViewModal item={selectedItem} onClose={onCloseView} />}
    </>
  );
}

type GoldenSetsPageViewProps = {
  agentsCount: number;
  filterAgent: string;
  filteredSets: EvalGoldenSet[];
  goldenSetsCount: number;
  handleDelete: (id: string) => void | Promise<void>;
  loadData: () => Promise<void>;
  selectedItem: EvalGoldenSet | null;
  setFilterAgent: (v: string) => void;
  setSelectedItem: (v: EvalGoldenSet | null) => void;
  showCreateModal: boolean;
  showLoading: boolean;
  toggleCreate: (v: boolean) => void;
};

function GoldenSetsPageView(props: Readonly<GoldenSetsPageViewProps>) {
  if (props.showLoading) return <GoldenSetsPageLoading />;

  return (
    <div>
      <GoldenSetsPageHeader
        goldenSetsCount={props.goldenSetsCount}
        agentsCount={props.agentsCount}
        filterAgent={props.filterAgent}
        setFilterAgent={props.setFilterAgent}
        onAddClick={() => props.toggleCreate(true)}
      />
      <GoldenSetsPageBody
        filteredSets={props.filteredSets}
        setSelectedItem={props.setSelectedItem}
        handleDelete={props.handleDelete}
      />
      <GoldenSetsPageModals
        loadData={props.loadData}
        showCreateModal={props.showCreateModal}
        selectedItem={props.selectedItem}
        onCloseCreate={() => props.toggleCreate(false)}
        onCloseView={() => props.setSelectedItem(null)}
      />
    </div>
  );
}

export function GoldenSetsPageImpl() {
  const state = useGoldenSetsState();
  const supabase = createClient();

  const loadData = useLoadGoldenSets(supabase, state);
  const handleDelete = useDeleteGoldenSet({ supabase, loadData });

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const { agents, filteredSets } = useGoldenSetsDerived(state.goldenSets, state.filterAgent);

  return (
    <GoldenSetsPageView
      showLoading={state.loading}
      goldenSetsCount={state.goldenSets.length}
      agentsCount={agents.length}
      filterAgent={state.filterAgent}
      setFilterAgent={state.setFilterAgent}
      filteredSets={filteredSets}
      setSelectedItem={state.setSelectedItem}
      handleDelete={handleDelete}
      loadData={loadData}
      showCreateModal={state.showCreateModal}
      selectedItem={state.selectedItem}
      toggleCreate={(v) => state.setShowCreateModal(v)}
    />
  );
}
