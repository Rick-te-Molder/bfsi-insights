import type { PromptVersion } from '@/types/database';
import { AgentTable } from './components';

interface AgentsTableSectionProps {
  readonly agents: string[];
  readonly promptsByAgent: Record<string, PromptVersion[]>;
  readonly onEdit: (prompt: PromptVersion) => void;
  readonly onTest: (prompt: PromptVersion) => void;
}

export function AgentsTableSection({
  agents,
  promptsByAgent,
  onEdit,
  onTest,
}: AgentsTableSectionProps) {
  return (
    <div className="rounded-xl border border-neutral-800 overflow-hidden">
      <div className="overflow-auto">
        <AgentTable
          agents={agents}
          promptsByAgent={promptsByAgent}
          onEdit={onEdit}
          onTest={onTest}
        />
      </div>
    </div>
  );
}
