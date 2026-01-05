'use client';

import { useState } from 'react';
import { bulkReenrichAction, bulkRejectAction, bulkApproveAction } from './actions';

type SetSelected = (s: Set<string>) => void;
type Router = { refresh: () => void };

function useSuccessMessage() {
  const [message, setMessage] = useState<string | null>(null);
  const show = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 5000);
  };
  return { message, show };
}

async function runApprove(
  ids: Set<string>,
  clear: () => void,
  setLoading: (s: string | null) => void,
  show: (m: string) => void,
  refresh: () => void,
) {
  if (ids.size === 0 || !confirm(`Approve ${ids.size} items?`)) return;
  setLoading('approve');
  show(`⏳ Approving ${ids.size} items...`);
  const r = await bulkApproveAction(Array.from(ids));
  show(r.success ? `✅ ${r.count} items approved` : `❌ Failed: ${r.error}`);
  setLoading(null);
  clear();
  refresh();
}

async function runReject(
  ids: Set<string>,
  clear: () => void,
  setLoading: (s: string | null) => void,
  show: (m: string) => void,
  refresh: () => void,
) {
  if (ids.size === 0) return;
  const reason = prompt(`Rejection reason for ${ids.size} items:`);
  if (!reason) return;
  setLoading('reject');
  show(`⏳ Rejecting ${ids.size} items...`);
  const r = await bulkRejectAction(Array.from(ids), reason);
  show(r.success ? `✅ ${r.count} items rejected` : `❌ Failed: ${r.error}`);
  setLoading(null);
  clear();
  refresh();
}

async function runReenrich(
  ids: Set<string>,
  clear: () => void,
  setLoading: (s: string | null) => void,
  show: (m: string) => void,
  refresh: () => void,
) {
  if (ids.size === 0 || !confirm(`Re-enrich ${ids.size} items?`)) return;
  setLoading('reenrich');
  show(`⏳ ${ids.size} items queued...`);
  const r = await bulkReenrichAction(Array.from(ids));
  show(r.success ? `✅ ${r.queued} items queued` : `❌ Failed: ${r.error}`);
  setLoading(null);
  clear();
  refresh();
}

export function useBulkActions(selected: Set<string>, setSelected: SetSelected, router: Router) {
  const [loading, setLoading] = useState<string | null>(null);
  const { message, show } = useSuccessMessage();
  const clear = () => setSelected(new Set());
  const refresh = () => router.refresh();

  const actions = {
    approve: () => runApprove(selected, clear, setLoading, show, refresh),
    reject: () => runReject(selected, clear, setLoading, show, refresh),
    reenrich: () => runReenrich(selected, clear, setLoading, show, refresh),
  };

  return { loading, message, actions };
}
