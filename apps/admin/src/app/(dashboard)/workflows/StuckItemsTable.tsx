'use client';

import { AlertTriangle } from 'lucide-react';
import type { StuckItem } from './types';

function getFailureCountColor(count: number): string {
  return count > 2 ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800';
}

function StuckItemsTableHeader() {
  return (
    <thead className="bg-gray-50">
      <tr>
        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">URL</th>
        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
          Last Step
        </th>
        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
          Failures
        </th>
        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Stuck</th>
      </tr>
    </thead>
  );
}

function StuckItemRow({ item }: Readonly<{ item: StuckItem }>) {
  return (
    <tr>
      <td className="px-4 py-2">
        <a
          href={`/items/${item.id}`}
          className="text-blue-600 hover:underline text-sm truncate block max-w-xs"
          title={item.url}
        >
          {item.url.substring(0, 50)}...
        </a>
      </td>
      <td className="px-4 py-2">
        <span className="text-xs bg-gray-100 px-2 py-1 rounded">{item.status_name}</span>
      </td>
      <td className="px-4 py-2 text-sm text-gray-500">{item.last_failed_step || '-'}</td>
      <td className="px-4 py-2 text-right">
        <span className={`px-2 py-1 text-xs rounded ${getFailureCountColor(item.failure_count)}`}>
          {item.failure_count}
        </span>
      </td>
      <td className="px-4 py-2 text-right text-orange-600 font-mono">
        {item.stuck_hours.toFixed(1)}h
      </td>
    </tr>
  );
}

function StuckItemsEmptyRow() {
  return (
    <tr>
      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
        No stuck items
      </td>
    </tr>
  );
}

export function StuckItemsTable({ stuckItems }: Readonly<{ stuckItems: StuckItem[] }>) {
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <h2 className="font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          Stuck Items (Top 10)
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <StuckItemsTableHeader />
          <tbody className="divide-y divide-gray-200">
            {stuckItems.length === 0 ? (
              <StuckItemsEmptyRow />
            ) : (
              stuckItems.map((item) => <StuckItemRow key={item.id} item={item} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
