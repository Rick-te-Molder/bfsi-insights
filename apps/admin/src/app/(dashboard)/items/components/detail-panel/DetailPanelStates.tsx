'use client';

export function DetailPanelEmpty() {
  return (
    <div className="flex h-full items-center justify-center text-neutral-500">
      <div className="text-center">
        <p className="text-lg">Select an item to view details</p>
        <p className="text-sm mt-2">Use ↑/↓ or j/k to navigate</p>
      </div>
    </div>
  );
}

export function DetailPanelLoading() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-sky-500 border-t-transparent" />
    </div>
  );
}

export function DetailPanelNotFound() {
  return <div className="flex h-full items-center justify-center text-red-400">Item not found</div>;
}
