export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function getStageBadge(stage?: string) {
  switch (stage) {
    case 'PRD':
      return { label: 'Live', className: 'bg-emerald-500/20 text-emerald-300' };
    case 'TST':
      return { label: 'Test', className: 'bg-amber-500/20 text-amber-300' };
    case 'DEV':
      return { label: 'Draft', className: 'bg-neutral-500/20 text-neutral-300' };
    case 'RET':
      return { label: 'Retired', className: 'bg-neutral-600/20 text-neutral-400' };
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
  // Extract agent prefix (e.g., "tagger" from "tagger-v2.3")
  const prefixMatch = currentVersion.match(/^([a-z-]+)-v/);
  const prefix = prefixMatch ? prefixMatch[1] : '';

  // Extract version numbers
  const match = currentVersion.match(/v?(\d+)\.?(\d*)/);
  if (match) {
    const major = parseInt(match[1]);
    const minor = match[2] ? parseInt(match[2]) + 1 : 1;
    const newVersion = `v${major}.${minor}`;
    return prefix ? `${prefix}-${newVersion}` : newVersion;
  }
  return `${currentVersion}-2`;
}
