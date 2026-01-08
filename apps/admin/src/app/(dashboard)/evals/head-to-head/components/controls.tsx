'use client';

function LLMJudgeCheckbox({
  checked,
  onChange,
}: Readonly<{ checked: boolean; onChange: (v: boolean) => void }>) {
  return (
    <label className="flex items-center gap-2 text-sm text-neutral-400">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-neutral-700 bg-neutral-800"
      />{' '}
      Use LLM Judge (experimental)
    </label>
  );
}

function RunButton({
  onClick,
  disabled,
  running,
}: Readonly<{ onClick: () => void; disabled: boolean; running: boolean }>) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {running ? 'Running...' : 'Run Comparison'}
    </button>
  );
}

export function ComparisonControls({
  useLLMJudge,
  setUseLLMJudge,
  onRun,
  running,
  disabled,
}: Readonly<{
  useLLMJudge: boolean;
  setUseLLMJudge: (v: boolean) => void;
  onRun: () => void;
  running: boolean;
  disabled: boolean;
}>) {
  return (
    <div className="mt-4 flex items-center justify-between">
      <LLMJudgeCheckbox checked={useLLMJudge} onChange={setUseLLMJudge} />
      <RunButton onClick={onRun} disabled={disabled} running={running} />
    </div>
  );
}
