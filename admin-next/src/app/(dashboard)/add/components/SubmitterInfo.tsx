'use client';

import { AUDIENCES, CHANNELS, URGENCY_OPTIONS } from '../constants';

interface SubmitterInfoProps {
  submitterName: string;
  setSubmitterName: (name: string) => void;
  submitterChannel: string;
  setSubmitterChannel: (channel: string) => void;
  submitterAudience: string;
  setSubmitterAudience: (audience: string) => void;
  submitterUrgency: string;
  setSubmitterUrgency: (urgency: string) => void;
}

export function SubmitterInfo({
  submitterName,
  setSubmitterName,
  submitterChannel,
  setSubmitterChannel,
  submitterAudience,
  setSubmitterAudience,
  submitterUrgency,
  setSubmitterUrgency,
}: SubmitterInfoProps) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 space-y-4">
      <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wide">
        Who Sent This?
      </h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">
            Name / Company <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={submitterName}
            onChange={(e) => setSubmitterName(e.target.value)}
            placeholder="John Smith, Acme Corp"
            required
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-white placeholder-neutral-500 focus:border-sky-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">
            Channel <span className="text-red-400">*</span>
          </label>
          <select
            value={submitterChannel}
            onChange={(e) => setSubmitterChannel(e.target.value)}
            required
            className={`w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 focus:border-sky-500 focus:outline-none ${submitterChannel ? 'text-white' : 'text-neutral-500'}`}
          >
            <option value="" disabled>
              Select channel...
            </option>
            {CHANNELS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-2">
          Their Role / Audience <span className="text-red-400">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {AUDIENCES.map((aud) => (
            <button
              key={aud.value}
              type="button"
              onClick={() => setSubmitterAudience(aud.value)}
              className={`p-3 rounded-lg border text-left transition-colors ${
                submitterAudience === aud.value
                  ? 'border-sky-500 bg-sky-500/20 text-white'
                  : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-600'
              }`}
            >
              <div className="font-medium">{aud.label}</div>
              <div className="text-xs text-neutral-500">{aud.description}</div>
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-2">
          Urgency <span className="text-red-400">*</span>
        </label>
        <div className="flex gap-2">
          {URGENCY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSubmitterUrgency(opt.value)}
              className={`px-4 py-2 rounded-lg border transition-colors ${
                submitterUrgency === opt.value
                  ? 'border-sky-500 bg-sky-500/20'
                  : 'border-neutral-700 bg-neutral-800 hover:border-neutral-600'
              } ${opt.color}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
