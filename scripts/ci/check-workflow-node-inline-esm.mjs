#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const WORKFLOWS_DIR = path.resolve(process.cwd(), '.github', 'workflows');

function listWorkflowFiles() {
  if (!fs.existsSync(WORKFLOWS_DIR)) return [];

  return fs
    .readdirSync(WORKFLOWS_DIR)
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .map((name) => path.join(WORKFLOWS_DIR, name));
}

function findNonExplicitNodeE(workflowPath) {
  const content = fs.readFileSync(workflowPath, 'utf8');
  const lines = content.split(/\r?\n/);

  const findings = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.includes('node')) continue;
    if (!line.includes(' -e ')) continue;

    if (line.includes('--input-type=module')) continue;

    findings.push({
      lineNumber: i + 1,
      line: line.trim(),
    });
  }

  return findings;
}

function main() {
  const workflows = listWorkflowFiles();
  if (workflows.length === 0) {
    console.log('No workflow files found.');
    return;
  }

  let total = 0;

  for (const workflowPath of workflows) {
    const findings = findNonExplicitNodeE(workflowPath);
    if (findings.length === 0) continue;

    for (const finding of findings) {
      total += 1;
      console.log(
        `WARN: Non-ESM-explicit inline node usage in workflow: ${path.basename(
          workflowPath,
        )}:${finding.lineNumber}: ${finding.line}`,
      );
    }
  }

  if (total === 0) {
    console.log('OK: No non-ESM-explicit inline node -e usage found in workflows.');
  } else {
    console.log(`Found ${total} potential non-ESM-explicit node -e usage(s).`);
    console.log(
      'Recommendation: use `node --input-type=module -e "..."` for ESM snippets or move the script into a committed .mjs file.',
    );
  }
}

main();
