import { useState } from 'react';

interface ComparisonResult {
  itemId: string;
  title: string;
  versionA: string;
  versionB: string;
  outputA: Record<string, unknown>;
  outputB: Record<string, unknown>;
  winner?: 'A' | 'B' | 'tie';
  reasoning?: string;
}

interface RunComparisonParams {
  selectedAgent: string;
  versionA: string;
  versionB: string;
  selectedItem: string;
  useLLMJudge: boolean;
  setResults: (updater: (prev: ComparisonResult[]) => ComparisonResult[]) => void;
}

export function useComparison() {
  const [running, setRunning] = useState(false);

  async function runComparison(params: RunComparisonParams) {
    const { selectedAgent, versionA, versionB, selectedItem, useLLMJudge, setResults } = params;

    if (!versionA || !versionB || !selectedItem) {
      alert('Please select two versions and an item to compare');
      return;
    }

    if (versionA === versionB) {
      alert('Please select two different versions');
      return;
    }

    setRunning(true);
    try {
      const res = await fetch('/api/evals/head-to-head', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentName: selectedAgent,
          versionAId: versionA,
          versionBId: versionB,
          itemId: selectedItem,
          useLLMJudge,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setResults((prev) => [data.result, ...prev]);
      } else {
        const data = await res.json();
        alert('Failed to run comparison: ' + data.error);
      }
    } catch {
      alert('Network error');
    } finally {
      setRunning(false);
    }
  }

  return { running, runComparison };
}
