'use client';

import type { PromptABTest } from '@/types/database';

const BTN = 'rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50';
const BTN_PRIMARY = `${BTN} text-white`;
const BTN_OUTLINE = `${BTN} border`;

function StartButton({
  updating,
  onClick,
}: Readonly<{ updating: string | null; onClick: () => void }>) {
  return (
    <button
      onClick={onClick}
      disabled={updating !== null}
      className={`${BTN_PRIMARY} bg-emerald-600 hover:bg-emerald-500`}
    >
      {updating === 'running' ? 'Starting...' : '▶ Start Test'}
    </button>
  );
}

function RunningButtons({
  updating,
  onPause,
  onComplete,
}: Readonly<{
  updating: string | null;
  onPause: () => void;
  onComplete: () => void;
}>) {
  return (
    <>
      <button
        onClick={onPause}
        disabled={updating !== null}
        className={`${BTN_PRIMARY} bg-amber-600 hover:bg-amber-500`}
      >
        ⏸ Pause
      </button>
      <button
        onClick={onComplete}
        disabled={updating !== null}
        className={`${BTN_PRIMARY} bg-sky-600 hover:bg-sky-500`}
      >
        ✓ Complete
      </button>
    </>
  );
}

function ResumeButton({
  updating,
  onClick,
}: Readonly<{ updating: string | null; onClick: () => void }>) {
  return (
    <button
      onClick={onClick}
      disabled={updating !== null}
      className={`${BTN_PRIMARY} bg-emerald-600 hover:bg-emerald-500`}
    >
      ▶ Resume
    </button>
  );
}

function PromoteButtons({
  updating,
  onPromote,
}: Readonly<{
  updating: string | null;
  onPromote: (w: 'a' | 'b') => void;
}>) {
  return (
    <>
      <button
        onClick={() => onPromote('a')}
        disabled={updating !== null}
        className={`${BTN_OUTLINE} border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20`}
      >
        Promote A
      </button>
      <button
        onClick={() => onPromote('b')}
        disabled={updating !== null}
        className={`${BTN_OUTLINE} border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20`}
      >
        Promote B
      </button>
    </>
  );
}

function WinnerBadge({ winner }: Readonly<{ winner: string }>) {
  return (
    <div className="text-emerald-400 text-sm py-2">
      ✓ Variant {winner.toUpperCase()} promoted as current
    </div>
  );
}

interface ActionButtonsProps {
  test: PromptABTest;
  updating: string | null;
  updateStatus: (s: string) => void;
  promoteWinner: (w: 'a' | 'b') => void;
}

function StatusButtons({
  test,
  updating,
  updateStatus,
}: Readonly<{
  test: PromptABTest;
  updating: string | null;
  updateStatus: (s: string) => void;
}>) {
  if (test.status === 'draft')
    return <StartButton updating={updating} onClick={() => updateStatus('running')} />;
  if (test.status === 'running')
    return (
      <RunningButtons
        updating={updating}
        onPause={() => updateStatus('paused')}
        onComplete={() => updateStatus('completed')}
      />
    );
  if (test.status === 'paused')
    return <ResumeButton updating={updating} onClick={() => updateStatus('running')} />;
  return null;
}

export function ActionButtons({
  test,
  updating,
  updateStatus,
  promoteWinner,
}: Readonly<ActionButtonsProps>) {
  const showPromote = (test.status === 'completed' || test.items_processed > 0) && !test.winner;
  return (
    <div className="flex flex-wrap gap-2">
      <StatusButtons test={test} updating={updating} updateStatus={updateStatus} />
      {showPromote && <PromoteButtons updating={updating} onPromote={promoteWinner} />}
      {test.winner && <WinnerBadge winner={test.winner} />}
    </div>
  );
}
