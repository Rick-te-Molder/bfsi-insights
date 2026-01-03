import Link from 'next/link';
import type { SubmissionStatus } from '../../types';

export function FormActions({ status }: { status: SubmissionStatus }) {
  return (
    <div className="flex gap-3">
      <button
        type="submit"
        disabled={status === 'submitting'}
        className="rounded-lg bg-sky-600 px-6 py-3 font-medium text-white hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'submitting' ? 'Submitting...' : 'Report Missed Article'}
      </button>
      <Link
        href="/items"
        className="rounded-lg border border-neutral-700 px-6 py-3 font-medium text-neutral-300 hover:bg-neutral-800"
      >
        Go to Items Queue
      </Link>
    </div>
  );
}
