import { useState } from 'react';

export function useSubmitterFields() {
  const [submitterName, setSubmitterName] = useState('');
  const [submitterAudience, setSubmitterAudience] = useState('');
  const [submitterChannel, setSubmitterChannel] = useState('email');
  const [submitterUrgency, setSubmitterUrgency] = useState('important');

  return {
    submitterName,
    setSubmitterName,
    submitterAudience,
    setSubmitterAudience,
    submitterChannel,
    setSubmitterChannel,
    submitterUrgency,
    setSubmitterUrgency,
  };
}
