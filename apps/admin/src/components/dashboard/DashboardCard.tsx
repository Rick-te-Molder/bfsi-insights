'use client';

import { ReactNode } from 'react';

type CardColor = 'cyan' | 'emerald' | 'violet';

interface DashboardCardProps {
  title: string;
  badge?: string | number;
  color?: CardColor;
  children: ReactNode;
}

const badgeColorClasses: Record<CardColor, string> = {
  cyan: 'text-cyan-400',
  emerald: 'text-emerald-400',
  violet: 'text-violet-400',
};

export function DashboardCard({
  title,
  badge,
  color = 'emerald',
  children,
}: Readonly<DashboardCardProps>) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {badge !== undefined && (
          <span className={`text-sm ${badgeColorClasses[color]}`}>{badge}</span>
        )}
      </div>
      {children}
    </div>
  );
}

export type { CardColor };
