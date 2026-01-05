'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

function getCountColorClass(
  isActive: boolean,
  activeColor: string | undefined,
  count: number,
  color: string,
): string {
  if (isActive) return (activeColor || '') + ' text-white';
  if (count > 0) return color;
  return 'text-neutral-500';
}

function getContainerBorderClass(isActive: boolean, count: number, borderColor: string): string {
  if (isActive) return 'ring-2 ring-offset-1 ring-offset-neutral-900';
  if (count > 0) return borderColor;
  return 'border-neutral-700';
}

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

function getCodeClass(isActive: boolean | undefined, activeColor: string | undefined): string {
  return isActive ? (activeColor || '') + ' text-white' : 'bg-neutral-700/50 text-neutral-400';
}

function getNameClass(isActive: boolean | undefined, activeColor: string | undefined): string {
  return isActive ? (activeColor || '') + ' text-white' : 'bg-neutral-700/50 text-neutral-300';
}

function CodeSpan({
  code,
  isActive,
  activeColor,
}: Readonly<{
  code: number;
  isActive?: boolean;
  activeColor?: string;
}>) {
  return (
    <span className={cn('pl-2 pr-1 py-1 font-mono', getCodeClass(isActive, activeColor))}>
      {code}
    </span>
  );
}

function NameSpan({
  name,
  isActive,
  activeColor,
}: Readonly<{
  name: string;
  isActive?: boolean;
  activeColor?: string;
}>) {
  return (
    <span className={cn('pr-2 py-1', getNameClass(isActive, activeColor))}>
      {name.replaceAll('_', ' ')}
    </span>
  );
}

function CountSpan({
  count,
  color,
  isActive,
  activeColor,
}: Readonly<{
  count: number;
  color: string;
  isActive?: boolean;
  activeColor?: string;
}>) {
  return (
    <span
      className={cn(
        'px-2 py-1 font-bold',
        getCountColorClass(isActive ?? false, activeColor, count, color),
      )}
    >
      {count}
    </span>
  );
}

function PillContent({
  code,
  name,
  count,
  color,
  isActive,
  activeColor,
}: Readonly<Omit<StatusPillProps, 'borderColor' | 'href'>>) {
  return (
    <>
      <CodeSpan code={code} isActive={isActive} activeColor={activeColor} />
      <NameSpan name={name} isActive={isActive} activeColor={activeColor} />
      <CountSpan count={count} color={color} isActive={isActive} activeColor={activeColor} />
    </>
  );
}

function useContainerClass(
  isActive: boolean,
  count: number,
  borderColor: string,
  activeColor?: string,
  href?: string,
) {
  return cn(
    'inline-flex items-center rounded-full text-xs overflow-hidden transition-colors',
    getContainerBorderClass(isActive, count, borderColor),
    isActive && activeColor?.replace('bg-', 'ring-'),
    'border',
    href && 'hover:opacity-80',
  );
}

function PillWrapper({
  href,
  className,
  title,
  children,
}: Readonly<{
  href?: string;
  className: string;
  title: string;
  children: React.ReactNode;
}>) {
  if (href)
    return (
      <Link href={href} className={className} title={title}>
        {children}
      </Link>
    );
  return (
    <div className={className} title={title}>
      {children}
    </div>
  );
}

export function StatusPill(props: Readonly<StatusPillProps>) {
  const { code, name, count, color, borderColor, isActive = false, activeColor, href } = props;
  const containerClass = useContainerClass(isActive, count, borderColor, activeColor, href);
  const title = `Code ${code}: ${name} (${count} items)`;

  return (
    <PillWrapper href={href} className={containerClass} title={title}>
      <PillContent
        code={code}
        name={name}
        count={count}
        color={color}
        isActive={isActive}
        activeColor={activeColor}
      />
    </PillWrapper>
  );
}
