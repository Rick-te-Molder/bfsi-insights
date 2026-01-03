'use client';

import type { DragEvent, ReactNode } from 'react';
import type { SubmissionStatus } from '../types';

function PdfTitleInput(props: {
  readonly pdfTitle: string;
  readonly setPdfTitle: (t: string) => void;
}) {
  return (
    <div>
      <label htmlFor="pdfTitle" className="block text-sm font-medium text-neutral-300 mb-2">
        Title <span className="text-red-400">*</span>
      </label>
      <input
        type="text"
        id="pdfTitle"
        value={props.pdfTitle}
        onChange={(e) => props.setPdfTitle(e.target.value)}
        placeholder="e.g., ECB Working Paper on Inflation"
        className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3 text-white placeholder-neutral-500 focus:border-sky-500 focus:outline-none"
      />
    </div>
  );
}

function getDropzoneClass(pdfFile: File | null) {
  return pdfFile
    ? 'border-emerald-500/50 bg-emerald-500/10'
    : 'border-neutral-700 hover:border-neutral-600';
}

function maybeUseFilenameAsTitle(file: File, pdfTitle: string, setPdfTitle: (t: string) => void) {
  if (!pdfTitle) setPdfTitle(file.name.replace('.pdf', ''));
}

function PdfDropzoneDisplay(props: {
  readonly pdfFile: File | null;
  readonly onRemove: () => void;
}) {
  return props.pdfFile ? (
    <div className="space-y-2">
      <p className="text-emerald-400">📄 {props.pdfFile.name}</p>
      <p className="text-xs text-neutral-500">{(props.pdfFile.size / 1024 / 1024).toFixed(2)} MB</p>
      <button
        type="button"
        onClick={props.onRemove}
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
  );
}

function PdfFileInput(props: {
  readonly pdfTitle: string;
  readonly setPdfTitle: (t: string) => void;
  readonly setPdfFile: (f: File | null) => void;
}) {
  return (
    <input
      id="pdfFile"
      type="file"
      accept=".pdf,application/pdf"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) {
          props.setPdfFile(file);
          maybeUseFilenameAsTitle(file, props.pdfTitle, props.setPdfTitle);
        }
      }}
      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
    />
  );
}

function handleDragOver(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
}

function handleDrop(
  e: DragEvent,
  pdfTitle: string,
  setPdfTitle: (t: string) => void,
  setPdfFile: (f: File | null) => void,
) {
  e.preventDefault();
  e.stopPropagation();
  const file = e.dataTransfer.files[0];
  if (file?.type === 'application/pdf') {
    setPdfFile(file);
    maybeUseFilenameAsTitle(file, pdfTitle, setPdfTitle);
  }
}

function PdfDropzoneShell(props: {
  readonly pdfFile: File | null;
  readonly className: string;
  readonly onDrop: (e: DragEvent) => void;
  readonly onRemove: () => void;
  readonly children: ReactNode;
}) {
  return (
    <label
      htmlFor="pdfFile"
      className={`relative rounded-lg border-2 border-dashed transition-colors ${props.className}`}
      onDragOver={handleDragOver}
      onDrop={props.onDrop}
    >
      {props.children}
      <div className="p-6 text-center">
        <PdfDropzoneDisplay pdfFile={props.pdfFile} onRemove={props.onRemove} />
      </div>
    </label>
  );
}

function PdfDropzone(props: {
  readonly pdfFile: File | null;
  readonly setPdfFile: (f: File | null) => void;
  readonly pdfTitle: string;
  readonly setPdfTitle: (t: string) => void;
}) {
  const onDrop = (e: DragEvent) =>
    handleDrop(e, props.pdfTitle, props.setPdfTitle, props.setPdfFile);
  return (
    <PdfDropzoneShell
      pdfFile={props.pdfFile}
      className={getDropzoneClass(props.pdfFile)}
      onDrop={onDrop}
      onRemove={() => props.setPdfFile(null)}
    >
      <PdfFileInput
        pdfTitle={props.pdfTitle}
        setPdfTitle={props.setPdfTitle}
        setPdfFile={props.setPdfFile}
      />
    </PdfDropzoneShell>
  );
}

function UploadProgressBar(props: { readonly uploadProgress: number }) {
  return (
    <div className="mt-2">
      <div className="h-1 rounded-full bg-neutral-700 overflow-hidden">
        <div
          className="h-full bg-sky-500 transition-all duration-300"
          style={{ width: `${props.uploadProgress}%` }}
        />
      </div>
      <p className="text-xs text-neutral-500 mt-1">Uploading... {props.uploadProgress}%</p>
    </div>
  );
}

export function PdfSection(props: {
  readonly pdfFile: File | null;
  readonly setPdfFile: (f: File | null) => void;
  readonly pdfTitle: string;
  readonly setPdfTitle: (t: string) => void;
  readonly status: SubmissionStatus;
  readonly uploadProgress: number;
}) {
  return (
    <div className="space-y-3">
      <PdfTitleInput pdfTitle={props.pdfTitle} setPdfTitle={props.setPdfTitle} />
      <div>
        <label htmlFor="pdfFile" className="block text-sm font-medium text-neutral-300 mb-2">
          PDF File <span className="text-red-400">*</span>
        </label>
        <PdfDropzone
          pdfFile={props.pdfFile}
          setPdfFile={props.setPdfFile}
          pdfTitle={props.pdfTitle}
          setPdfTitle={props.setPdfTitle}
        />
        {props.status === 'uploading' && (
          <UploadProgressBar uploadProgress={props.uploadProgress} />
        )}
      </div>
    </div>
  );
}
