// Date and small formatting helpers

export function fmt(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function withLabel(label: string, value?: string): string {
  if (!value) return '';
  return `${label} ${value}`;
}
