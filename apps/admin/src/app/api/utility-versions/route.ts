import { NextResponse } from 'next/server';

/**
 * Utility Agent Version Registry
 * Keep in sync with services/agent-api/src/lib/utility-versions.js
 */
const UTILITY_VERSIONS = {
  'thumbnail-generator': '1.0.0',
};

export async function GET() {
  const versions = Object.entries(UTILITY_VERSIONS).map(([agent_name, version]) => ({
    agent_name,
    version,
  }));

  return NextResponse.json(versions);
}
