interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Loading...' }: Readonly<LoadingStateProps>) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-neutral-400">{message}</div>
    </div>
  );
}
