'use client';

import { CheckCircle2, XCircle } from 'lucide-react';
import type { StepFailureRate } from './types';

function getFailureRateColor(rate: number): string {
  if (rate > 10) return 'bg-red-100 text-red-800';
  if (rate > 0) return 'bg-yellow-100 text-yellow-800';
  return 'bg-green-100 text-green-800';
}

function StepFailureTableHeader() {
  return (
    <thead className="bg-gray-50">
      <tr>
        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Step</th>
        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
          Succeeded
        </th>
        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Failed</th>
        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Avg</th>
      </tr>
    </thead>
  );
}

function StepFailureRow({ step }: { step: StepFailureRate }) {
  return (
    <tr>
      <td className="px-4 py-2 font-medium">{step.step_name}</td>
      <td className="px-4 py-2 text-right">{step.total_runs}</td>
      <td className="px-4 py-2 text-right text-green-600">
        <CheckCircle2 className="h-4 w-4 inline mr-1" />
        {step.succeeded}
      </td>
      <td className="px-4 py-2 text-right text-red-600">
        <XCircle className="h-4 w-4 inline mr-1" />
        {step.failed}
      </td>
      <td className="px-4 py-2 text-right">
        <span className={`px-2 py-1 text-xs rounded ${getFailureRateColor(step.failure_rate_pct)}`}>
          {step.failure_rate_pct}%
        </span>
      </td>
      <td className="px-4 py-2 text-right text-gray-500">
        {step.avg_duration_seconds?.toFixed(1)}s
      </td>
    </tr>
  );
}

function StepFailureEmptyRow() {
  return (
    <tr>
      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
        No step runs in the last 24 hours
      </td>
    </tr>
  );
}

export function StepFailureTable({ stepFailures }: { stepFailures: StepFailureRate[] }) {
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <h2 className="font-semibold">Step Failure Rates (Last 24h)</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <StepFailureTableHeader />
          <tbody className="divide-y divide-gray-200">
            {stepFailures.length === 0 ? (
              <StepFailureEmptyRow />
            ) : (
              stepFailures.map((step) => <StepFailureRow key={step.step_name} step={step} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
