'use client';

import { useState } from 'react';
import type { Source } from '@/types/database';
import { useSourceData, useFormatTimeAgo, useSourceFilters } from './hooks';
import { SourcesContent } from './components/SourcesContent';

function useModalState(loadSources: () => void) {
  const [editingSource, setEditingSource] = useState<Source | null>(null);
  const [showModal, setShowModal] = useState(false);
  const openAdd = () => {
    setEditingSource(null);
    setShowModal(true);
  };
  const openEdit = (source: Source) => {
    setEditingSource(source);
    setShowModal(true);
  };
  const closeModal = () => {
    setShowModal(false);
    setEditingSource(null);
  };
  const handleSave = () => {
    closeModal();
    loadSources();
  };
  return { editingSource, showModal, openAdd, openEdit, closeModal, handleSave };
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-neutral-400">Loading sources...</div>
    </div>
  );
}

export default function SourcesPage() {
  const { sources, healthData, loading, loadSources, toggleEnabled } = useSourceData();
  const filters = useSourceFilters();
  const modal = useModalState(loadSources);
  const formatTimeAgo = useFormatTimeAgo();
  if (loading) return <LoadingState />;
  return (
    <SourcesContent
      sources={sources}
      healthData={healthData}
      toggleEnabled={toggleEnabled}
      filters={filters}
      modal={modal}
      formatTimeAgo={formatTimeAgo}
    />
  );
}
