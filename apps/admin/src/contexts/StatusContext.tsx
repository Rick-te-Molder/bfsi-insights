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

// Default color for unknown statuses (DB is single source of truth for all known statuses)
const DEFAULT_COLOR = 'bg-neutral-500/20 text-neutral-300';

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
  const [statuses, setStatuses] = useState<StatusInfo[]>([]);
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
  const getStatusColor = (code: number) => getStatusByCode(code)?.color || DEFAULT_COLOR;
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
