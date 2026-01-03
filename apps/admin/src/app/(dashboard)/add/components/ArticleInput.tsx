'use client';

import type { InputMode, SubmissionStatus } from '../types';

interface ArticleInputProps {
  inputMode: InputMode;
  setInputMode: (mode: InputMode) => void;
  url: string;
  setUrl: (url: string) => void;
  pdfFile: File | null;
  setPdfFile: (file: File | null) => void;
  pdfTitle: string;
  setPdfTitle: (title: string) => void;
  detectedDomain: string | null;
  existingSource: string | null;
  status: SubmissionStatus;
  uploadProgress: number;
}

export function ArticleInput({
  inputMode,
  setInputMode,
  url,
  setUrl,
  pdfFile,
  setPdfFile,
  pdfTitle,
  setPdfTitle,
  detectedDomain,
  existingSource,
  status,
  uploadProgress,
}: ArticleInputProps) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wide">
          The Article
        </h2>
        <div className="flex rounded-lg border border-neutral-700 p-0.5">
          <button
            type="button"
            onClick={() => setInputMode('url')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              inputMode === 'url' ? 'bg-sky-600 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            🔗 URL
          </button>
          <button
            type="button"
            onClick={() => setInputMode('pdf')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              inputMode === 'pdf' ? 'bg-sky-600 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            📄 PDF
          </button>
        </div>
      </div>

      {inputMode === 'url' ? (
        <div>
          <label htmlFor="url" className="block text-sm font-medium text-neutral-300 mb-2">
            URL <span className="text-red-400">*</span>
          </label>
          <input
            type="url"
            id="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/article"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3 text-white placeholder-neutral-500 focus:border-sky-500 focus:outline-none"
          />
          {detectedDomain && (
            <p className="mt-2 text-sm">
              {existingSource ? (
                <span className="text-amber-400">
                  ⚠️ We track <strong>{existingSource}</strong> — why did we miss this?
                </span>
              ) : (
                <span className="text-sky-400">
                  ⚡ New domain: <strong>{detectedDomain}</strong> (not tracked)
                </span>
              )}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label htmlFor="pdfTitle" className="block text-sm font-medium text-neutral-300 mb-2">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              id="pdfTitle"
              value={pdfTitle}
              onChange={(e) => setPdfTitle(e.target.value)}
              placeholder="e.g., ECB Working Paper on Inflation"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3 text-white placeholder-neutral-500 focus:border-sky-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              PDF File <span className="text-red-400">*</span>
            </label>
            <div
              className={`relative rounded-lg border-2 border-dashed transition-colors ${
                pdfFile
                  ? 'border-emerald-500/50 bg-emerald-500/10'
                  : 'border-neutral-700 hover:border-neutral-600'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files[0];
                if (file?.type === 'application/pdf') {
                  setPdfFile(file);
                  if (!pdfTitle) setPdfTitle(file.name.replace('.pdf', ''));
                }
              }}
            >
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setPdfFile(file);
                    if (!pdfTitle) setPdfTitle(file.name.replace('.pdf', ''));
                  }
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="p-6 text-center">
                {pdfFile ? (
                  <div className="space-y-2">
                    <p className="text-emerald-400">📄 {pdfFile.name}</p>
                    <p className="text-xs text-neutral-500">
                      {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPdfFile(null);
                      }}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-neutral-400">
                      📎 Drop PDF here or <span className="text-sky-400">browse</span>
                    </p>
                    <p className="text-xs text-neutral-500">Max 50MB</p>
                  </div>
                )}
              </div>
            </div>
            {status === 'uploading' && (
              <div className="mt-2">
                <div className="h-1 rounded-full bg-neutral-700 overflow-hidden">
                  <div
                    className="h-full bg-sky-500 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-neutral-500 mt-1">Uploading... {uploadProgress}%</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
