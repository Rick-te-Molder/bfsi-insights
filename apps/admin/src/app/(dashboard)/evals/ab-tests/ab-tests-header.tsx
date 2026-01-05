'use client';

interface AbTestsHeaderProps {
  onCreate: () => void;
}

export function AbTestsHeader({ onCreate }: Readonly<AbTestsHeaderProps>) {
  return (
    <header className="mb-6 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-white">A/B Testing</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Compare prompt versions with traffic splitting
        </p>
      </div>
      <button
        onClick={onCreate}
        className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
      >
        + New Test
      </button>
    </header>
  );
}
