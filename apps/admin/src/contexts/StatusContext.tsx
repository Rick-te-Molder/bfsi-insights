'use client';

import { createContext, useContext, useEffect, useState, useMemo, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';

interface StatusInfo {
  code: number;
  name: string;
  description: string | null;
  category: string;
  is_terminal: boolean;
  color: string | null;
}

interface StatusContextType {
  statuses: StatusInfo[];
  loading: boolean;
  getStatusName: (code: number) => string;
  getStatusColor: (code: number) => string;
  getStatusByCode: (code: number) => StatusInfo | undefined;
}

// Fallback color mapping by status name (used when DB color is null)
const FALLBACK_COLORS: Record<string, string> = {
  // Enrichment stages
  pending_enrichment: 'bg-neutral-500/20 text-neutral-300',
  to_summarize: 'bg-amber-500/20 text-amber-300',
  summarizing: 'bg-amber-500/30 text-amber-200',
  to_tag: 'bg-amber-500/20 text-amber-300',
  tagging: 'bg-amber-500/30 text-amber-200',
  to_thumbnail: 'bg-amber-500/20 text-amber-300',
  thumbnailing: 'bg-amber-500/30 text-amber-200',
  enriched: 'bg-emerald-500/20 text-emerald-300',
  // Review stages
  pending_review: 'bg-sky-500/20 text-sky-300',
  in_review: 'bg-sky-500/30 text-sky-200',
  editing: 'bg-sky-500/30 text-sky-200',
  approved: 'bg-green-500/20 text-green-300',
  // Published
  published: 'bg-green-500/30 text-green-200',
  // Terminal
  failed: 'bg-red-500/20 text-red-300',
  irrelevant: 'bg-neutral-500/20 text-neutral-400',
  rejected: 'bg-red-500/20 text-red-300',
  dead_letter: 'bg-red-500/30 text-red-200',
};

const DEFAULT_COLOR = 'bg-neutral-500/20 text-neutral-300';

// Fallback values in case DB load fails
const FALLBACK_STATUSES: StatusInfo[] = [
  { code: 200, name: 'pending_enrichment', description: null, category: 'enrichment', is_terminal: false, color: null },
  { code: 210, name: 'to_summarize', description: null, category: 'enrichment', is_terminal: false, color: null },
  { code: 211, name: 'summarizing', description: null, category: 'enrichment', is_terminal: false, color: null },
  { code: 220, name: 'to_tag', description: null, category: 'enrichment', is_terminal: false, color: null },
  { code: 221, name: 'tagging', description: null, category: 'enrichment', is_terminal: false, color: null },
  { code: 230, name: 'to_thumbnail', description: null, category: 'enrichment', is_terminal: false, color: null },
  { code: 231, name: 'thumbnailing', description: null, category: 'enrichment', is_terminal: false, color: null },
  { code: 240, name: 'enriched', description: null, category: 'enrichment', is_terminal: false, color: null },
  { code: 300, name: 'pending_review', description: null, category: 'review', is_terminal: false, color: null },
  { code: 330, name: 'approved', description: null, category: 'review', is_terminal: false, color: null },
  { code: 400, name: 'published', description: null, category: 'published', is_terminal: true, color: null },
  { code: 500, name: 'failed', description: null, category: 'terminal', is_terminal: true, color: null },
  { code: 530, name: 'irrelevant', description: null, category: 'terminal', is_terminal: true, color: null },
  { code: 540, name: 'rejected', description: null, category: 'terminal', is_terminal: true, color: null },
  { code: 599, name: 'dead_letter', description: null, category: 'terminal', is_terminal: true, color: null },
];

const StatusContext = createContext<StatusContextType | null>(null);

async function fetchStatuses(): Promise<StatusInfo[] | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('status_lookup')
      .select('code, name, description, category, is_terminal, color')
      .order('code');
    if (error) {
      console.error('Failed to load status codes:', error.message);
      return null;
    }
    return data?.length ? data : null;
  } catch (err) {
    console.error('Error loading status codes:', err);
    return null;
  }
}

function useStatusData() {
  const [statuses, setStatuses] = useState<StatusInfo[]>(FALLBACK_STATUSES);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetchStatuses().then((data) => {
      if (data) setStatuses(data);
      setLoading(false);
    });
  }, []);
  return { statuses, loading };
}

function useStatusHelpers(statuses: StatusInfo[]) {
  const getStatusByCode = (code: number) => statuses.find((s) => s.code === code);
  const getStatusName = (code: number) => getStatusByCode(code)?.name || `status_${code}`;
  const getStatusColor = (code: number) => {
    const status = getStatusByCode(code);
    // Use DB color if available, otherwise fall back to hardcoded map, then default
    return status?.color || FALLBACK_COLORS[status?.name || ''] || DEFAULT_COLOR;
  };
  return { getStatusByCode, getStatusName, getStatusColor };
}

export function StatusProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { statuses, loading } = useStatusData();
  const helpers = useStatusHelpers(statuses);
  const value = useMemo(() => ({ statuses, loading, ...helpers }), [statuses, loading, helpers]);
  return <StatusContext.Provider value={value}>{children}</StatusContext.Provider>;
}

export function useStatus() {
  const context = useContext(StatusContext);
  if (!context) {
    throw new Error('useStatus must be used within a StatusProvider');
  }
  return context;
}
