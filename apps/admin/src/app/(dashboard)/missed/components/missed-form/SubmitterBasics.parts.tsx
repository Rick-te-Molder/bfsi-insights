export function SubmitterNameField({
  submitterName,
  setSubmitterName,
}: {
  submitterName: string;
  setSubmitterName: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-300 mb-2">Name / Company</label>
      <input
        type="text"
        value={submitterName}
        onChange={(e) => setSubmitterName(e.target.value)}
        placeholder="John Smith, Acme Corp"
        className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-white placeholder-neutral-500 focus:border-sky-500 focus:outline-none"
      />
    </div>
  );
}

export function SubmitterChannelSelect({
  submitterChannel,
  setSubmitterChannel,
  channels,
}: {
  submitterChannel: string;
  setSubmitterChannel: (v: string) => void;
  channels: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-300 mb-2">Channel</label>
      <select
        value={submitterChannel}
        onChange={(e) => setSubmitterChannel(e.target.value)}
        className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-white focus:border-sky-500 focus:outline-none"
      >
        {channels.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
    </div>
  );
}
