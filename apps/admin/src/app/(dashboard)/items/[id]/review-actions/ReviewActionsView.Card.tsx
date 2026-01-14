export function ActionsCard({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">{children}</div>
  );
}

export function ActionsCardHeader({ itemId }: Readonly<{ itemId?: string }>) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide">Actions</h3>
      {itemId && <div className="mt-2 text-xs text-neutral-300 font-mono break-all">{itemId}</div>}
    </div>
  );
}
