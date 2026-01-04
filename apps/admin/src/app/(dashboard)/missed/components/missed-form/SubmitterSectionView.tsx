import { SubmitterAudience, SubmitterBasics, SubmitterUrgency } from './SubmitterSection.parts';

type Props = {
  submitterName: string;
  setSubmitterName: (v: string) => void;
  submitterChannel: string;
  setSubmitterChannel: (v: string) => void;
  submitterAudience: string;
  setSubmitterAudience: (v: string) => void;
  submitterUrgency: string;
  setSubmitterUrgency: (v: string) => void;
  audiences: Array<{ value: string; label: string; description: string }>;
  channels: Array<{ value: string; label: string }>;
  urgencyOptions: Array<{ value: string; label: string; color: string }>;
};

export function SubmitterSectionView(props: Readonly<Props>) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 space-y-4">
      <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wide">
        Who Sent This?
      </h2>
      <SubmitterBasics
        submitterName={props.submitterName}
        setSubmitterName={props.setSubmitterName}
        submitterChannel={props.submitterChannel}
        setSubmitterChannel={props.setSubmitterChannel}
        channels={props.channels}
      />
      <SubmitterAudience
        submitterAudience={props.submitterAudience}
        setSubmitterAudience={props.setSubmitterAudience}
        audiences={props.audiences}
      />
      <SubmitterUrgency
        submitterUrgency={props.submitterUrgency}
        setSubmitterUrgency={props.setSubmitterUrgency}
        urgencyOptions={props.urgencyOptions}
      />
    </div>
  );
}
