interface TagBadgeProps {
  code: string;
  type:
    | 'audience'
    | 'geography'
    | 'industry'
    | 'topic'
    | 'regulator'
    | 'regulation'
    | 'process'
    | 'obligation';
}

const TAG_STYLES = {
  audience: 'bg-amber-500/10 text-amber-300 ring-amber-500/20',
  geography: 'bg-teal-500/10 text-teal-300 ring-teal-500/20',
  industry: 'bg-blue-500/10 text-blue-300 ring-blue-500/20',
  topic: 'bg-violet-500/10 text-violet-300 ring-violet-500/20',
  regulator: 'bg-rose-500/10 text-rose-300 ring-rose-500/20',
  regulation: 'bg-orange-500/10 text-orange-300 ring-orange-500/20',
  process: 'bg-cyan-500/10 text-cyan-300 ring-cyan-500/20',
  obligation: 'bg-purple-500/10 text-purple-300 ring-purple-500/20',
};

export function TagBadge({ code, type }: TagBadgeProps) {
  const showIcon = type === 'audience' || type === 'geography';

  return (
    <span
      className={`inline-flex items-center ${showIcon ? 'gap-1' : ''} px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${TAG_STYLES[type]}`}
    >
      {type === 'audience' && (
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      )}
      {type === 'geography' && (
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      )}
      {code}
    </span>
  );
}
