export function PublishedDateInput({
  value,
  onChange,
}: Readonly<{
  value: string;
  onChange: (v: string) => void;
}>) {
  return (
    <input
      id="publication-date-input"
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
    />
  );
}

export function PublishedDateSaveButton({
  disabled,
  loading,
  onClick,
}: Readonly<{
  disabled: boolean;
  loading: string | null;
  onClick: () => void;
}>) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-2 rounded-lg bg-neutral-700 text-sm font-medium text-white hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {loading === 'update-date' ? 'Saving...' : 'Save'}
    </button>
  );
}
