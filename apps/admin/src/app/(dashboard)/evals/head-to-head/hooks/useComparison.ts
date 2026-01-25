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

function validateParams(params: RunComparisonParams): string | null {
  const { versionA, versionB, selectedItem } = params;

  if (!versionA || !versionB || !selectedItem) {
    return 'Please select two versions and an item to compare';
  }
  if (versionA === versionB) {
    return 'Please select two different versions';
  }
  return null;
}

async function executeComparison(params: RunComparisonParams): Promise<void> {
  const { selectedAgent, versionA, versionB, selectedItem, useLLMJudge, setResults } = params;

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
    throw new Error(data.error || 'Unknown error');
  }
}

export function useComparison() {
  const [running, setRunning] = useState(false);

  async function runComparison(params: RunComparisonParams) {
    const validationError = validateParams(params);
    if (validationError) {
      alert(validationError);
      return;
    }

    setRunning(true);
    try {
      await executeComparison(params);
    } catch (err) {
      alert(err instanceof Error ? `Failed: ${err.message}` : 'Network error');
    } finally {
      setRunning(false);
    }
  }

  return { running, runComparison };
}
