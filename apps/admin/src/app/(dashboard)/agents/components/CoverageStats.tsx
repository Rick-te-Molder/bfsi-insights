'use client';

import type { CoverageStats as CoverageStatsType } from '../types';

interface CoverageStatsProps {
  stats: CoverageStatsType;
}

const CARD_CLASS = 'rounded-lg border border-neutral-800 bg-neutral-900/50 p-4';

function StatCard({
  value,
  label,
  colorClass = 'text-white',
}: Readonly<{ value: string | number; label: string; colorClass?: string }>) {
  return (
    <div className={CARD_CLASS}>
      <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
      <div className="text-xs text-neutral-400">{label}</div>
    </div>
  );
}

function StatsGrid({ stats }: Readonly<{ stats: CoverageStatsType }>) {
  const coverageColor = stats.coverage === 100 ? 'text-emerald-400' : 'text-amber-400';
  const missingColor = stats.missingRequired.length === 0 ? 'text-emerald-400' : 'text-red-400';
  const missingValue = stats.missingRequired.length === 0 ? '✓' : stats.missingRequired.length;
  const missingLabel =
    stats.missingRequired.length === 0 ? 'All Required Present' : 'Missing Required';
  return (
    <div className="mt-4 grid grid-cols-4 gap-4">
      <StatCard value={stats.totalAgents} label="Agents in Manifest" />
      <StatCard value={stats.currentPrompts} label="Active Prompts" />
      <StatCard value={`${stats.coverage}%`} label="Required Coverage" colorClass={coverageColor} />
      <StatCard value={missingValue} label={missingLabel} colorClass={missingColor} />
    </div>
  );
}

function MissingAlert({ missingRequired }: Readonly<{ missingRequired: string[] }>) {
  if (missingRequired.length === 0) return null;
  return (
    <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
      <div className="flex items-start gap-3">
        <span className="text-red-400">⚠️</span>
        <div>
          <div className="font-medium text-red-300">Missing Required Prompts</div>
          <div className="mt-1 text-sm text-red-300/80">
            The following prompts are required but not found in the database:
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {missingRequired.map((name) => (
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
  );
}

export function CoverageStats({ stats }: Readonly<CoverageStatsProps>) {
  return (
    <>
      <StatsGrid stats={stats} />
      <MissingAlert missingRequired={stats.missingRequired} />
    </>
  );
}
