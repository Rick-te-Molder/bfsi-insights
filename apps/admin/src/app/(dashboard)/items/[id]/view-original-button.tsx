'use client';

import { useState } from 'react';

interface ViewOriginalButtonProps {
  queueId: string;
  rawRef: string | null;
  storageDeletedAt: string | null;
}

type ButtonState = 'idle' | 'loading' | 'error';

const BASE_STYLE =
  'inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors';

function getButtonText(state: ButtonState, errorMessage: string | null): string {
  if (state === 'loading') return 'Loading...';
  if (state === 'error' && errorMessage) return errorMessage;
  return 'View Original';
}

function getButtonStyle(state: ButtonState, disabled: boolean): string {
  if (disabled)
    return `${BASE_STYLE} border-neutral-700 bg-neutral-800/50 text-neutral-500 cursor-not-allowed`;
  if (state === 'error') return `${BASE_STYLE} border-red-800 bg-red-900/20 text-red-400`;
  return `${BASE_STYLE} border-emerald-700 bg-emerald-900/20 text-emerald-300 hover:bg-emerald-900/40`;
}

function getDisabledText(isDeleted: boolean, notStored: boolean): string | null {
  if (isDeleted) return 'Original was deleted';
  if (notStored) return 'Original not stored';
  return null;
}

function DocumentIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

async function fetchSignedUrl(queueId: string): Promise<{ signedUrl?: string; error?: string }> {
  const response = await fetch(`/api/raw-content/by-queue/${queueId}`);
  const data = await response.json();
  if (!response.ok) return { error: data.error || 'Failed to get URL' };
  return { signedUrl: data.signedUrl };
}

function useViewOriginal(queueId: string, disabled: boolean) {
  const [state, setState] = useState<ButtonState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleClick = async () => {
    if (disabled) return;
    setState('loading');
    setErrorMessage(null);

    try {
      const result = await fetchSignedUrl(queueId);
      if (result.error) {
        setState('error');
        setErrorMessage(result.error);
      } else if (result.signedUrl) {
        window.open(result.signedUrl, '_blank', 'noopener,noreferrer');
        setState('idle');
      }
    } catch {
      setState('error');
      setErrorMessage('Network error');
    }
  };

  return { state, errorMessage, handleClick };
}

export function ViewOriginalButton({
  queueId,
  rawRef,
  storageDeletedAt,
}: Readonly<ViewOriginalButtonProps>) {
  const isDeleted = !!storageDeletedAt;
  const notStored = !rawRef;
  const disabled = isDeleted || notStored;
  const disabledText = getDisabledText(isDeleted, notStored);
  const { state, errorMessage, handleClick } = useViewOriginal(queueId, disabled);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || state === 'loading'}
      className={getButtonStyle(state, disabled)}
      title={disabledText || undefined}
    >
      <DocumentIcon />
      {disabledText || getButtonText(state, errorMessage)}
    </button>
  );
}
