import { NextResponse } from 'next/server';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { join } from 'node:path';

export interface ManifestAgent {
  name: string;
  file: string;
  type: 'llm' | 'config' | 'orchestrator' | 'scoring';
  description: string;
  prompt_versions: string[];
  tables: string[];
  model?: string;
  owner: string;
}

export interface RequiredPrompt {
  agent_name: string;
  type: 'llm' | 'config';
  required: boolean;
}

export interface RequiredTable {
  table: string;
  min_rows: number;
  description: string;
}

export interface AgentManifest {
  agents: ManifestAgent[];
  required_prompts: RequiredPrompt[];
  required_tables: RequiredTable[];
}

export async function GET() {
  try {
    // Read manifest from docs/agents/manifest.yaml
    const manifestPath = join(process.cwd(), '..', 'docs', 'agents', 'manifest.yaml');
    const manifestContent = readFileSync(manifestPath, 'utf-8');
    const manifest = parse(manifestContent) as AgentManifest;

    return NextResponse.json(manifest);
  } catch (error) {
    console.error('Failed to load manifest:', error);

    // Return empty manifest if file not found (graceful degradation)
    return NextResponse.json({
      agents: [],
      required_prompts: [],
      required_tables: [],
      error: error instanceof Error ? error.message : 'Failed to load manifest',
    });
  }
}
