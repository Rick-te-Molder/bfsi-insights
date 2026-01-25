import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

export function goBackToItems(router: AppRouterInstance) {
  router.push('/items');
  router.refresh();
}

export function reloadItem(id: string) {
  globalThis.location.href = `/items/${id}`;
}
