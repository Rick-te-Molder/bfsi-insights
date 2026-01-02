import { useCallback } from 'react';

export function useSubmissionHandler(args: { doSubmit: () => Promise<void> }) {
  return useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      await args.doSubmit();
    },
    [args],
  );
}
