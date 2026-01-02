export function ActionsCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">{children}</div>
  );
}

export function ActionsCardHeader() {
  return (
    <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-4">Actions</h3>
  );
}
