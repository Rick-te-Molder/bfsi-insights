'use client';

import type { Source } from '@/types/database';
import { SourceModal } from './SourceModal';
import { SourceTable } from './SourceTable';
import { PageHeader, StatsBadges, Legend } from './FilterComponents';
import { FilterBar } from './FilterBar';
import { getDiscoveryInfo, getHealthBadge, getCategoryColor, calculateStats } from '../utils';
import { filterSources, useSourceFilters } from '../hooks';

interface SourcesContentProps {
  sources: Source[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  healthData: Map<string, any>;
  toggleEnabled: (s: Source) => void;
  filters: ReturnType<typeof useSourceFilters>;
  modal: {
    editingSource: Source | null;
    showModal: boolean;
    openAdd: () => void;
    openEdit: (s: Source) => void;
    closeModal: () => void;
    handleSave: () => void;
  };
  formatTimeAgo: (d: string | null) => string;
}

function HeaderSection({
  modal,
  stats,
}: Readonly<{
  modal: SourcesContentProps['modal'];
  stats: ReturnType<typeof calculateStats>;
}>) {
  return (
    <>
      <PageHeader onAdd={modal.openAdd} />
      <StatsBadges stats={stats} />
      <Legend />
    </>
  );
}

function TableSection({
  filteredSources,
  healthData,
  toggleEnabled,
  modal,
  formatTimeAgo,
}: Readonly<{
  filteredSources: Source[];
  healthData: SourcesContentProps['healthData'];
  toggleEnabled: SourcesContentProps['toggleEnabled'];
  modal: SourcesContentProps['modal'];
  formatTimeAgo: SourcesContentProps['formatTimeAgo'];
}>) {
  return (
    <SourceTable
      sources={filteredSources}
      healthData={healthData}
      onToggleEnabled={toggleEnabled}
      onEdit={modal.openEdit}
      formatTimeAgo={formatTimeAgo}
      getHealthBadge={getHealthBadge}
      getDiscoveryInfo={getDiscoveryInfo}
      getCategoryColor={getCategoryColor}
    />
  );
}

function ModalSection({ modal }: Readonly<{ modal: SourcesContentProps['modal'] }>) {
  if (!modal.showModal) return null;
  return (
    <SourceModal
      source={modal.editingSource}
      onClose={modal.closeModal}
      onSave={modal.handleSave}
    />
  );
}

export function SourcesContent({
  sources,
  healthData,
  toggleEnabled,
  filters,
  modal,
  formatTimeAgo,
}: Readonly<SourcesContentProps>) {
  const filteredSources = filterSources({ sources, healthData, ...filters });
  const categories = [...new Set(sources.map((s) => s.category).filter(Boolean))];
  return (
    <div>
      <HeaderSection modal={modal} stats={calculateStats(sources)} />
      <FilterBar {...filters} categories={categories} />
      <TableSection
        filteredSources={filteredSources}
        healthData={healthData}
        toggleEnabled={toggleEnabled}
        modal={modal}
        formatTimeAgo={formatTimeAgo}
      />
      <ModalSection modal={modal} />
    </div>
  );
}
