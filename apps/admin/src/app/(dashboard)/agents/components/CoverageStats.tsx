'use client';

import type { CoverageStats as CoverageStatsType } from '../types';

interface CoverageStatsProps {
  stats: CoverageStatsType;
}

export function CoverageStats({ stats }: CoverageStatsProps) {
  return (
    <>
      <div className="mt-4 grid grid-cols-4 gap-4">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="text-2xl font-bold text-white">{stats.totalAgents}</div>
          <div className="text-xs text-neutral-400">Agents in Manifest</div>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="text-2xl font-bold text-white">{stats.currentPrompts}</div>
          <div className="text-xs text-neutral-400">Active Prompts</div>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div
            className={`text-2xl font-bold ${stats.coverage === 100 ? 'text-emerald-400' : 'text-amber-400'}`}
          >
            {stats.coverage}%
          </div>
          <div className="text-xs text-neutral-400">Required Coverage</div>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div
            className={`text-2xl font-bold ${stats.missingRequired.length === 0 ? 'text-emerald-400' : 'text-red-400'}`}
          >
            {stats.missingRequired.length === 0 ? '✓' : stats.missingRequired.length}
          </div>
          <div className="text-xs text-neutral-400">
            {stats.missingRequired.length === 0 ? 'All Required Present' : 'Missing Required'}
          </div>
        </div>
      </div>

      {stats.missingRequired.length > 0 && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <div className="flex items-start gap-3">
            <span className="text-red-400">⚠️</span>
            <div>
              <div className="font-medium text-red-300">Missing Required Prompts</div>
              <div className="mt-1 text-sm text-red-300/80">
                The following prompts are required but not found in the database:
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {stats.missingRequired.map((name) => (
                  <span
                    key={name}
                    className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-300"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
