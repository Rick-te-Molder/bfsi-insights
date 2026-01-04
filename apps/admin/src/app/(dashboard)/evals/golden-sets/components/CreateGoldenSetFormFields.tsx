'use client';

function CreateGoldenSetFormAgentField({
  agentName,
  setAgentName,
  agentOptions,
}: Readonly<{
  agentName: string;
  setAgentName: (v: string) => void;
  agentOptions: string[];
}>) {
  return (
    <div>
      <label htmlFor="agent-select" className="block text-sm text-neutral-400 mb-1">
        Agent
      </label>
      <select
        id="agent-select"
        value={agentName}
        onChange={(e) => setAgentName(e.target.value)}
        className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
      >
        {agentOptions.map((agent) => (
          <option key={agent} value={agent}>
            {agent}
          </option>
        ))}
      </select>
    </div>
  );
}

function CreateGoldenSetFormNameField({
  name,
  setName,
}: Readonly<{
  name: string;
  setName: (v: string) => void;
}>) {
  return (
    <div>
      <label htmlFor="golden-set-name" className="block text-sm text-neutral-400 mb-1">
        Name
      </label>
      <input
        id="golden-set-name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g., Banking article with multiple topics"
        className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
      />
    </div>
  );
}

function CreateGoldenSetFormInputField({
  inputJson,
  setInputJson,
}: Readonly<{
  inputJson: string;
  setInputJson: (v: string) => void;
}>) {
  return (
    <div>
      <label htmlFor="golden-set-input" className="block text-sm text-neutral-400 mb-1">
        Input (JSON)
      </label>
      <textarea
        id="golden-set-input"
        value={inputJson}
        onChange={(e) => setInputJson(e.target.value)}
        className="w-full h-32 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-300 font-mono"
      />
    </div>
  );
}

function CreateGoldenSetFormExpectedField({
  expectedJson,
  setExpectedJson,
}: Readonly<{
  expectedJson: string;
  setExpectedJson: (v: string) => void;
}>) {
  return (
    <div>
      <label htmlFor="golden-set-output" className="block text-sm text-neutral-400 mb-1">
        Expected Output (JSON)
      </label>
      <textarea
        id="golden-set-output"
        value={expectedJson}
        onChange={(e) => setExpectedJson(e.target.value)}
        className="w-full h-32 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-300 font-mono"
      />
    </div>
  );
}

function CreateGoldenSetFormActions({
  handleCreate,
  onClose,
  saving,
}: Readonly<{
  handleCreate: () => void;
  onClose: () => void;
  saving: boolean;
}>) {
  return (
    <div className="p-4 border-t border-neutral-800 flex justify-end gap-3">
      <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-400 hover:text-white">
        Cancel
      </button>
      <button
        onClick={handleCreate}
        disabled={saving}
        className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
      >
        {saving ? 'Creating...' : 'Create'}
      </button>
    </div>
  );
}

export {
  CreateGoldenSetFormAgentField,
  CreateGoldenSetFormNameField,
  CreateGoldenSetFormInputField,
  CreateGoldenSetFormExpectedField,
  CreateGoldenSetFormActions,
};
