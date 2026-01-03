'use client';

import type { InputMode, SubmissionStatus } from '../types';
import { ModeToggle, UrlSection } from './ArticleInputUrl';
import { PdfSection } from './ArticleInputPdf';

interface ArticleInputProps {
  readonly inputMode: InputMode;
  readonly setInputMode: (mode: InputMode) => void;
  readonly url: string;
  readonly setUrl: (url: string) => void;
  readonly pdfFile: File | null;
  readonly setPdfFile: (file: File | null) => void;
  readonly pdfTitle: string;
  readonly setPdfTitle: (title: string) => void;
  readonly detectedDomain: string | null;
  readonly existingSource: string | null;
  readonly status: SubmissionStatus;
  readonly uploadProgress: number;
}

function ArticleHeader(props: {
  readonly inputMode: InputMode;
  readonly setInputMode: (m: InputMode) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wide">
        The Article
      </h2>
      <ModeToggle inputMode={props.inputMode} setInputMode={props.setInputMode} />
    </div>
  );
}

function ArticleBody(props: Readonly<ArticleInputProps>) {
  if (props.inputMode === 'url') {
    return (
      <UrlSection
        url={props.url}
        setUrl={props.setUrl}
        detectedDomain={props.detectedDomain}
        existingSource={props.existingSource}
      />
    );
  }
  return (
    <PdfSection
      pdfFile={props.pdfFile}
      setPdfFile={props.setPdfFile}
      pdfTitle={props.pdfTitle}
      setPdfTitle={props.setPdfTitle}
      status={props.status}
      uploadProgress={props.uploadProgress}
    />
  );
}

export function ArticleInput(props: Readonly<ArticleInputProps>) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 space-y-4">
      <ArticleHeader inputMode={props.inputMode} setInputMode={props.setInputMode} />
      <ArticleBody {...props} />
    </div>
  );
}
