/**
 * CLI Utility Functions
 */

// Parse a string value, converting to number if numeric
export function parseValue(value) {
  return /^\d+$/.test(value) ? Number.parseInt(value, 10) : value;
}

// Parse a single CLI argument, returns { key, value, consumedNext }
function parseArgument(arg, nextArg) {
  if (!arg.startsWith('--')) return null;

  const [key, ...valueParts] = arg.slice(2).split('=');
  const hasEqualSign = valueParts.length > 0;

  if (hasEqualSign) {
    return { key, value: parseValue(valueParts.join('=')), consumedNext: false };
  }

  const nextIsValue = nextArg && !nextArg.startsWith('--');
  if (nextIsValue) {
    return { key, value: parseValue(nextArg), consumedNext: true };
  }

  return { key, value: true, consumedNext: false };
}

// Parse CLI arguments
// Supports both --limit=5 and --limit 5 formats
export function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0];
  const options = {};
  const remainingArgs = args.slice(1);
  let skipNext = false;

  for (let i = 0; i < remainingArgs.length; i++) {
    if (skipNext) {
      skipNext = false;
      continue;
    }

    const parsed = parseArgument(remainingArgs[i], remainingArgs[i + 1]);
    if (parsed) {
      options[parsed.key] = parsed.value;
      skipNext = parsed.consumedNext;
    }
  }

  return { command, options };
}

// Queue health helpers
const STATUS_ICONS = {
  pending: '⏳',
  enriched: '✅',
  rejected: '❌',
};

export function getStatusIcon(status) {
  return STATUS_ICONS[status] || '📝';
}

export function categorizePendingByAge(pending) {
  const now = new Date();
  const buckets = { last_24h: 0, last_week: 0, last_month: 0, older: 0 };
  const sourceCount = {};

  pending.forEach((item) => {
    const days = (now - new Date(item.discovered_at)) / (1000 * 60 * 60 * 24);

    if (days < 1) buckets.last_24h++;
    else if (days < 7) buckets.last_week++;
    else if (days < 30) buckets.last_month++;
    else buckets.older++;

    const source = item.payload?.source || 'unknown';
    sourceCount[source] = (sourceCount[source] || 0) + 1;
  });

  return { buckets, sourceCount, now };
}

export function printPendingBreakdown(pending) {
  const { buckets, sourceCount, now } = categorizePendingByAge(pending);

  console.log('   By age:');
  console.log(`      Last 24h:  ${buckets.last_24h}`);
  console.log(`      Last week: ${buckets.last_week}`);
  console.log(`      Last month: ${buckets.last_month}`);
  console.log(`      Older:     ${buckets.older}`);

  console.log('\n   By source (top 5):');
  Object.entries(sourceCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([source, count]) => {
      console.log(`      ${source.padEnd(30)}: ${count}`);
    });

  const oldest = pending[0];
  if (oldest) {
    const oldestAge = Math.round((now - new Date(oldest.discovered_at)) / (1000 * 60 * 60 * 24));
    console.log(`\n   ⚠️ Oldest pending: ${oldestAge} days old`);
    console.log(`      ${oldest.payload?.title?.substring(0, 50)}...`);
  }
}
