'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

interface StatusPillProps {
  code: number;
  name: string;
  count: number;
  color: string;
  borderColor: string;
  isActive?: boolean;
  activeColor?: string;
  href?: string;
}

function PillContent({
  code,
  name,
  count,
  color,
  isActive,
  activeColor,
}: Omit<StatusPillProps, 'borderColor' | 'href'>) {
  return (
    <>
      <span
        className={cn(
          'pl-2 pr-1 py-1 font-mono',
          isActive ? activeColor + ' text-white' : 'bg-neutral-700/50 text-neutral-300',
        )}
      >
        {code}
      </span>
      <span
        className={cn(
          'pr-2 py-1',
          isActive ? activeColor + ' text-white' : 'bg-neutral-700/50 text-neutral-300',
        )}
      >
        {name.replace(/_/g, ' ')}
      </span>
      <span
        className={cn(
          'px-2 py-1 font-bold',
          isActive ? activeColor + ' text-white' : count > 0 ? color : 'text-neutral-500',
        )}
      >
        {count}
      </span>
    </>
  );
}

export function StatusPill({
  code,
  name,
  count,
  color,
  borderColor,
  isActive = false,
  activeColor,
  href,
}: StatusPillProps) {
  const containerClass = cn(
    'inline-flex items-center rounded-full text-xs overflow-hidden transition-colors',
    isActive
      ? 'ring-2 ring-offset-1 ring-offset-neutral-900'
      : count > 0
        ? borderColor
        : 'border-neutral-700',
    isActive && activeColor?.replace('bg-', 'ring-'),
    'border',
    href && 'hover:opacity-80',
  );

  const content = (
    <PillContent
      code={code}
      name={name}
      count={count}
      color={color}
      isActive={isActive}
      activeColor={activeColor}
    />
  );

  if (href) {
    return (
      <Link href={href} className={containerClass} title={`Code ${code}: ${name} (${count} items)`}>
        {content}
      </Link>
    );
  }

  return (
    <div className={containerClass} title={`Code ${code}: ${name} (${count} items)`}>
      {content}
    </div>
  );
}
