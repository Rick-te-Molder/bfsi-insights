import Link from 'next/link';

export function CompareLink({ itemId }: { itemId: string }) {
  return (
    <Link
      href={`/evals/head-to-head?item=${itemId}`}
      className="block w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-700 hover:text-white text-center transition-colors"
    >
      Compare head-to-head
    </Link>
  );
}
