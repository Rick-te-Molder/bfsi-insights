import { useState } from 'react';
import type { SubmissionStatus } from '../../types';

export function useSubmissionFeedback() {
  const [status, setStatus] = useState<SubmissionStatus>('idle');
  const [message, setMessage] = useState('');

  return { status, setStatus, message, setMessage };
}
