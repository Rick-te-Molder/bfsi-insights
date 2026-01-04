interface GoldenSetsHeaderProps {
  goldenSetsCount: number;
  agentsCount: number;
  filterAgent: string;
  setFilterAgent: (v: string) => void;
  onAddClick: () => void;
}

function GoldenSetsStats({
  goldenSetsCount,
  agentsCount,
}: Readonly<{
  goldenSetsCount: number;
  agentsCount: number;
}>) {
  return (
    <div className="flex gap-4">
      <div className="rounded-lg bg-neutral-800/50 px-4 py-2 text-center">
        <div className="text-xl font-bold text-white">{goldenSetsCount}</div>
        <div className="text-xs text-neutral-500">Total Cases</div>
      </div>
      <div className="rounded-lg bg-neutral-800/50 px-4 py-2 text-center">
        <div className="text-xl font-bold text-sky-400">{agentsCount}</div>
        <div className="text-xs text-neutral-500">Agents</div>
      </div>
    </div>
  );
}

function GoldenSetsFilter({
  filterAgent,
  setFilterAgent,
}: Readonly<{
  filterAgent: string;
  setFilterAgent: (v: string) => void;
}>) {
  const agents = ['all', 'tagger', 'summarizer', 'screener'];

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-neutral-400">Filter:</span>
      <select
        value={filterAgent}
        onChange={(e) => setFilterAgent(e.target.value)}
        className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-white"
      >
        {agents.map((agent) => (
          <option key={agent} value={agent}>
            {agent === 'all' ? 'All Agents' : agent}
          </option>
        ))}
      </select>
    </div>
  );
}

function GoldenSetsHeaderMain({ onAddClick }: Readonly<{ onAddClick: () => void }>) {
  return (
    <header className="mb-6 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-white">Golden Sets</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Curated test cases with expected outputs for evaluation
        </p>
      </div>
      <button
        onClick={onAddClick}
        className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
      >
        + Add Test Case
      </button>
    </header>
  );
}

function GoldenSetsHeaderStatsFilter({
  goldenSetsCount,
  agentsCount,
  filterAgent,
  setFilterAgent,
}: Readonly<{
  goldenSetsCount: number;
  agentsCount: number;
  filterAgent: string;
  setFilterAgent: (v: string) => void;
}>) {
  return (
    <div className="flex items-center justify-between mb-6">
      <GoldenSetsStats goldenSetsCount={goldenSetsCount} agentsCount={agentsCount} />
      <GoldenSetsFilter filterAgent={filterAgent} setFilterAgent={setFilterAgent} />
    </div>
  );
}

function GoldenSetsHeaderContent({
  goldenSetsCount,
  agentsCount,
  filterAgent,
  setFilterAgent,
  onAddClick,
}: Readonly<{
  goldenSetsCount: number;
  agentsCount: number;
  filterAgent: string;
  setFilterAgent: (v: string) => void;
  onAddClick: () => void;
}>) {
  return (
    <>
      <GoldenSetsHeaderMain onAddClick={onAddClick} />
      <GoldenSetsHeaderStatsFilter
        goldenSetsCount={goldenSetsCount}
        agentsCount={agentsCount}
        filterAgent={filterAgent}
        setFilterAgent={setFilterAgent}
      />
    </>
  );
}

export function GoldenSetsHeader({
  goldenSetsCount,
  agentsCount,
  filterAgent,
  setFilterAgent,
  onAddClick,
}: Readonly<GoldenSetsHeaderProps>) {
  return (
    <GoldenSetsHeaderContent
      goldenSetsCount={goldenSetsCount}
      agentsCount={agentsCount}
      filterAgent={filterAgent}
      setFilterAgent={setFilterAgent}
      onAddClick={onAddClick}
    />
  );
}
