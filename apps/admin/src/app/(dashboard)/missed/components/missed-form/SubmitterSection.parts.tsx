import { SubmitterChannelSelect, SubmitterNameField } from './SubmitterBasics.parts';

export function SubmitterBasics({
  submitterName,
  setSubmitterName,
  submitterChannel,
  setSubmitterChannel,
  channels,
}: Readonly<{
  submitterName: string;
  setSubmitterName: (v: string) => void;
  submitterChannel: string;
  setSubmitterChannel: (v: string) => void;
  channels: Array<{ value: string; label: string }>;
}>) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <SubmitterNameField submitterName={submitterName} setSubmitterName={setSubmitterName} />
      <SubmitterChannelSelect
        submitterChannel={submitterChannel}
        setSubmitterChannel={setSubmitterChannel}
        channels={channels}
      />
    </div>
  );
}

export function SubmitterAudience({
  submitterAudience,
  setSubmitterAudience,
  audiences,
}: Readonly<{
  submitterAudience: string;
  setSubmitterAudience: (v: string) => void;
  audiences: Array<{ value: string; label: string; description: string }>;
}>) {
  return (
    <fieldset>
      <legend className="block text-sm font-medium text-neutral-300 mb-2">
        Their Role / Audience <span className="text-red-400">*</span>
      </legend>
      <div className="grid grid-cols-2 gap-2">
        {audiences.map((aud) => (
          <button
            key={aud.value}
            type="button"
            onClick={() => setSubmitterAudience(aud.value)}
            className={`p-3 rounded-lg border text-left transition-colors ${submitterAudience === aud.value ? 'border-sky-500 bg-sky-500/20 text-white' : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-600'}`}
          >
            <div className="font-medium">{aud.label}</div>
            <div className="text-xs text-neutral-500">{aud.description}</div>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function SubmitterUrgency({
  submitterUrgency,
  setSubmitterUrgency,
  urgencyOptions,
}: Readonly<{
  submitterUrgency: string;
  setSubmitterUrgency: (v: string) => void;
  urgencyOptions: Array<{ value: string; label: string; color: string }>;
}>) {
  return (
    <fieldset>
      <legend className="block text-sm font-medium text-neutral-300 mb-2">Urgency</legend>
      <div className="flex gap-2">
        {urgencyOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setSubmitterUrgency(opt.value)}
            className={`px-4 py-2 rounded-lg border transition-colors ${submitterUrgency === opt.value ? 'border-sky-500 bg-sky-500/20' : 'border-neutral-700 bg-neutral-800 hover:border-neutral-600'} ${opt.color}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
