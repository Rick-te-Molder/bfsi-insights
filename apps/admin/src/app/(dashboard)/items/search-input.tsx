interface SearchInputProps {
  readonly query: string;
  readonly onChange: (value: string) => void;
  readonly onClear: () => void;
}

export function SearchInput({ query, onChange, onClear }: SearchInputProps) {
  return (
    <div className="relative flex-1 sm:w-64">
      <input
        type="text"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search titles..."
        className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-white placeholder-neutral-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
      />
      {query && (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
        >
          ✕
        </button>
      )}
    </div>
  );
}
