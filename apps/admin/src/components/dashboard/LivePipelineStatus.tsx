'use client';

import { useState, useEffect, useCallback } from 'react';
import { PipelineStatusGrid } from './PipelineStatusGrid';

interface StatusData {
  code: number;
  name: string;
  category: string;
  count: number;
}

interface LivePipelineStatusProps {
  initialData: StatusData[];
  pollInterval?: number;
}

function useLivePipelineData(initialData: StatusData[], pollInterval: number) {
  const [statusData, setStatusData] = useState<StatusData[]>(initialData);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  useEffect(() => {
    setLastUpdated(new Date());
  }, []);
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/stats');
      if (res.ok) {
        const data = await res.json();
        setStatusData(data.statusData || []);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    }
  }, []);
  useEffect(() => {
    const interval = setInterval(fetchStats, pollInterval);
    return () => clearInterval(interval);
  }, [fetchStats, pollInterval]);
  return { statusData, lastUpdated };
}

/** KB-277: Live-updating pipeline status grid with polling */
export function LivePipelineStatus({
  initialData,
  pollInterval = 5000,
}: Readonly<LivePipelineStatusProps>) {
  const { statusData, lastUpdated } = useLivePipelineData(initialData, pollInterval);
  return (
    <div className="space-y-2">
      <PipelineStatusGrid statusData={statusData} />
      <p className="text-xs text-neutral-500 text-right">
        {lastUpdated && `Updated ${lastUpdated.toLocaleTimeString()}`}
      </p>
    </div>
  );
}
