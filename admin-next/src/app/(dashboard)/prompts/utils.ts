export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function getStageBadge(stage?: string) {
  switch (stage) {
    case 'production':
      return { label: 'Live', className: 'bg-emerald-500/20 text-emerald-300' };
    case 'staging':
      return { label: 'Staged', className: 'bg-amber-500/20 text-amber-300' };
    case 'development':
      return { label: 'Draft', className: 'bg-neutral-500/20 text-neutral-300' };
    default:
      return { label: stage || 'Unknown', className: 'bg-neutral-500/20 text-neutral-400' };
  }
}

export function getAgentIcon(agentName: string): string {
  if (agentName.includes('tagger')) return '🏷️';
  if (agentName.includes('summar')) return '📝';
  if (agentName.includes('filter')) return '🔍';
  return '🤖';
}

export function suggestNextVersion(currentVersion: string): string {
  const match = currentVersion.match(/v?(\d+)\.?(\d*)/);
  if (match) {
    const major = parseInt(match[1]);
    const minor = match[2] ? parseInt(match[2]) + 1 : 1;
    return `v${major}.${minor}`;
  }
  return `${currentVersion}-2`;
}
