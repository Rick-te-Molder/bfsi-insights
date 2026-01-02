import type { SubmissionStatus } from '../../types';

export function StatusBanner({ status, message }: { status: SubmissionStatus; message: string }) {
  if (status !== 'success' && status !== 'error') return null;

  const isSuccess = status === 'success';
  const border = isSuccess ? 'border-emerald-500/20' : 'border-red-500/20';
  const bg = isSuccess ? 'bg-emerald-500/10' : 'bg-red-500/10';
  const text = isSuccess ? 'text-emerald-300' : 'text-red-300';
  const icon = isSuccess ? '✅' : '❌';

  return (
    <div className={`mb-6 rounded-lg border ${border} ${bg} p-4`}>
      <p className={text}>
        {icon} {message}
      </p>
    </div>
  );
}
