export const AUDIENCES = [
  { value: 'executive', label: 'Executive', description: 'C-suite, Board, VP' },
  {
    value: 'functional_specialist',
    label: 'Functional Specialist',
    description: 'Risk, Compliance, Finance',
  },
  { value: 'engineer', label: 'Engineer', description: 'IT, Dev, Data' },
  { value: 'researcher', label: 'Researcher', description: 'Analyst, Academic' },
];

export const CHANNELS = [
  { value: 'email', label: 'Email' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'signal', label: 'Signal' },
  { value: 'slack', label: 'Slack' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'other', label: 'Other' },
];

export const URGENCY_OPTIONS = [
  { value: 'fyi', label: 'FYI', color: 'text-neutral-400' },
  { value: 'important', label: 'Important', color: 'text-amber-400' },
  { value: 'critical', label: 'Critical', color: 'text-red-400' },
];
