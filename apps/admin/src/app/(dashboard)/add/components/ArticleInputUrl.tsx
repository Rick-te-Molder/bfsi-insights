'use client';

import type { InputMode } from '../types';

export function ModeToggle(props: {
  readonly inputMode: InputMode;
  readonly setInputMode: (m: InputMode) => void;
}) {
  return (
    <div className="flex rounded-lg border border-neutral-700 p-0.5">
      <button
        type="button"
        onClick={() => props.setInputMode('url')}
        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
          props.inputMode === 'url' ? 'bg-sky-600 text-white' : 'text-neutral-400 hover:text-white'
        }`}
      >
        🔗 URL
      </button>
      <button
        type="button"
        onClick={() => props.setInputMode('pdf')}
        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
          props.inputMode === 'pdf' ? 'bg-sky-600 text-white' : 'text-neutral-400 hover:text-white'
        }`}
      >
        📄 PDF
      </button>
    </div>
  );
}

function UrlInput(props: { readonly url: string; readonly setUrl: (url: string) => void }) {
  return (
    <>
      <label htmlFor="url" className="block text-sm font-medium text-neutral-300 mb-2">
        URL <span className="text-red-400">*</span>
      </label>
      <input
        type="url"
        id="url"
        value={props.url}
        onChange={(e) => props.setUrl(e.target.value)}
        placeholder="https://example.com/article"
        className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3 text-white placeholder-neutral-500 focus:border-sky-500 focus:outline-none"
      />
    </>
  );
}

function DomainHint(props: {
  readonly detectedDomain: string;
  readonly existingSource: string | null;
}) {
  return (
    <p className="mt-2 text-sm">
      {props.existingSource ? (
        <span className="text-amber-400">
          ⚠️ We track <strong>{props.existingSource}</strong> — why did we miss this?
        </span>
      ) : (
        <span className="text-sky-400">
          ⚡ New domain: <strong>{props.detectedDomain}</strong> (not tracked)
        </span>
      )}
    </p>
  );
}

export function UrlSection(props: {
  readonly url: string;
  readonly setUrl: (url: string) => void;
  readonly detectedDomain: string | null;
  readonly existingSource: string | null;
}) {
  return (
    <div>
      <UrlInput url={props.url} setUrl={props.setUrl} />
      {props.detectedDomain && (
        <DomainHint detectedDomain={props.detectedDomain} existingSource={props.existingSource} />
      )}
    </div>
  );
}
