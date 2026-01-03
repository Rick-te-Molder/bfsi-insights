#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { spawnSync } from 'node:child_process';

function parseArgs(argv) {
  const args = { env: null, file: null };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === '--env') {
      args.env = argv[i + 1];
      i += 1;
      continue;
    }

    if (token === '--file') {
      args.file = argv[i + 1];
      i += 1;
      continue;
    }

    if (token.startsWith('--env=')) {
      args.env = token.split('=')[1];
      continue;
    }

    if (token.startsWith('--file=')) {
      args.file = token.split('=')[1];
      continue;
    }
  }

  return args;
}

function printUsageAndExit() {
  console.error('Usage: node scripts/run-sql.mjs --env=<local|staging|prod> --file <path-to-sql>');
  console.error('Defaults: DRY_RUN=1 (set DRY_RUN=0 to execute)');
  process.exit(2);
}

function getDatabaseUrl() {
  return process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || null;
}

function getHostFromUrl(databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    return url.host;
  } catch {
    return 'unknown-host';
  }
}

async function confirmProdExecution(host) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const question = (q) => new Promise((resolve) => rl.question(q, resolve));

  try {
    const answer = await question(
      `You are about to execute SQL against PROD (${host}). Type 'PROD' to continue: `,
    );
    return String(answer).trim() === 'PROD';
  } finally {
    rl.close();
  }
}

function writeRunLog(entry) {
  const logsDir = path.resolve(process.cwd(), 'scripts', 'sql', 'run-logs');
  fs.mkdirSync(logsDir, { recursive: true });

  const filePath = path.join(logsDir, 'runs.jsonl');
  fs.appendFileSync(filePath, `${JSON.stringify(entry)}\n`, 'utf8');
}

async function main() {
  const { env, file } = parseArgs(process.argv);
  if (!env || !file) printUsageAndExit();

  if (!['local', 'staging', 'prod'].includes(env)) {
    console.error(`Invalid --env value: ${env}`);
    printUsageAndExit();
  }

  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    console.error('Missing DATABASE_URL (or SUPABASE_DB_URL).');
    process.exit(2);
  }

  const host = getHostFromUrl(databaseUrl);
  const dryRun = process.env.DRY_RUN !== '0';

  const sqlPath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(sqlPath)) {
    console.error(`SQL file not found: ${sqlPath}`);
    process.exit(2);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');

  const runEntry = {
    ts: new Date().toISOString(),
    operator: process.env.USER || process.env.LOGNAME || 'unknown',
    git_commit: process.env.GITHUB_SHA || null,
    env,
    host,
    dry_run: dryRun,
    file: path.relative(process.cwd(), sqlPath),
  };

  console.log(`Target env: ${env}`);
  console.log(`Target host: ${host}`);
  console.log(`SQL file: ${runEntry.file}`);
  console.log(`DRY_RUN: ${dryRun ? '1 (no changes will be executed)' : '0 (will execute)'}`);

  if (env === 'prod' && !dryRun) {
    const ok = await confirmProdExecution(host);
    if (!ok) {
      console.error('Aborted.');
      process.exit(1);
    }
  }

  writeRunLog(runEntry);

  if (dryRun) {
    console.log('--- SQL (dry run preview) ---');
    console.log(sql);
    console.log('--- end ---');
    return;
  }

  const result = spawnSync('psql', ['-v', 'ON_ERROR_STOP=1', databaseUrl], {
    input: sql,
    stdio: ['pipe', 'inherit', 'inherit'],
    env: process.env,
  });

  if (result.error) {
    console.error('Failed to execute psql. Is psql installed and available on PATH?');
    throw result.error;
  }

  process.exit(result.status ?? 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
