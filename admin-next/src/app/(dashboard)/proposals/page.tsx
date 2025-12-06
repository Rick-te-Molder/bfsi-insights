import { createServiceRoleClient } from '@/lib/supabase/server';
import { formatDateTime } from '@/lib/utils';
import { ProposalActions } from './proposal-actions';

interface Proposal {
  id: string;
  entity_type: string;
  name: string;
  slug: string;
  metadata: Record<string, unknown>;
  source_url: string | null;
  source_title: string | null;
  created_at: string;
}

async function getPendingProposals() {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase.from('pending_entity_proposals').select('*');

  if (error) {
    console.error('Error fetching proposals:', error);
    return [];
  }

  return data as Proposal[];
}

const entityTypeLabels: Record<string, string> = {
  regulator: 'Regulator',
  standard_setter: 'Standard Setter',
  bfsi_organization: 'BFSI Organization',
  ag_vendor: 'AI/Agentic Vendor',
  regulation: 'Regulation',
};

const entityTypeColors: Record<string, string> = {
  regulator: 'bg-amber-500/20 text-amber-300',
  standard_setter: 'bg-orange-500/20 text-orange-300',
  bfsi_organization: 'bg-pink-500/20 text-pink-300',
  ag_vendor: 'bg-teal-500/20 text-teal-300',
  regulation: 'bg-purple-500/20 text-purple-300',
};

export default async function ProposalsPage() {
  const proposals = await getPendingProposals();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Entity Proposals</h1>
        <p className="mt-1 text-sm text-neutral-400">
          {proposals.length} pending proposals from agent discovery
        </p>
      </header>

      {proposals.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-12 text-center">
          <p className="text-neutral-400">No pending proposals</p>
          <p className="text-sm text-neutral-600 mt-1">
            Unknown entities discovered by the agent will appear here for approval
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 divide-y divide-neutral-800">
          {proposals.map((proposal) => (
            <div key={proposal.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${entityTypeColors[proposal.entity_type] || 'bg-neutral-500/20 text-neutral-300'}`}
                    >
                      {entityTypeLabels[proposal.entity_type] || proposal.entity_type}
                    </span>
                    <span className="font-medium text-white">{proposal.name}</span>
                    <span className="text-xs text-neutral-500">({proposal.slug})</span>
                  </div>

                  {proposal.source_title && (
                    <p className="text-sm text-neutral-400 mt-1">From: {proposal.source_title}</p>
                  )}

                  {proposal.source_url && (
                    <a
                      href={proposal.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-sky-400 hover:text-sky-300"
                    >
                      {proposal.source_url.slice(0, 60)}...
                    </a>
                  )}

                  <p className="text-xs text-neutral-600 mt-2">
                    Discovered {formatDateTime(proposal.created_at)}
                  </p>
                </div>

                <ProposalActions
                  proposalId={proposal.id}
                  entityType={proposal.entity_type}
                  name={proposal.name}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
