'use client';

import { AUDIENCES } from '../constants';

interface WhyValuableProps {
  whyValuable: string;
  setWhyValuable: (value: string) => void;
  verbatimComment: string;
  setVerbatimComment: (value: string) => void;
  suggestedAudiences: string[];
  toggleAudience: (audience: string) => void;
}

function WhyInput({ value, onChange }: Readonly<{ value: string; onChange: (v: string) => void }>) {
  return (
    <div>
      <label htmlFor="why" className="block text-sm font-medium text-neutral-300 mb-2">
        Why did they send this? What makes it valuable? <span className="text-red-400">*</span>
      </label>
      <textarea
        id="why"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        rows={3}
        placeholder="Board meeting next week on this topic... Client said 'this is exactly what we needed'..."
        className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3 text-white placeholder-neutral-500 focus:border-amber-500 focus:outline-none"
      />
    </div>
  );
}

function VerbatimInput({
  value,
  onChange,
}: Readonly<{ value: string; onChange: (v: string) => void }>) {
  return (
    <div>
      <label htmlFor="verbatimComment" className="block text-sm font-medium text-neutral-300 mb-2">
        Their exact words (optional)
      </label>
      <input
        id="verbatimComment"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder='"This is the kind of content that makes us look smart"'
        className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-white placeholder-neutral-500 focus:border-sky-500 focus:outline-none"
      />
    </div>
  );
}

function ExamplesHint() {
  return (
    <div className="text-xs text-neutral-500 space-y-1">
      <p className="font-medium">💡 Examples that help us learn:</p>
      <ul className="ml-4 space-y-0.5">
        <li>• &quot;Board asked about this exact topic last week&quot;</li>
        <li>• &quot;This is what our risk team has been searching for&quot;</li>
        <li>• &quot;Competitor mentioned this, we need to know too&quot;</li>
      </ul>
    </div>
  );
}

function WhyValuableCard({
  whyValuable,
  setWhyValuable,
  verbatimComment,
  setVerbatimComment,
}: Readonly<
  Pick<
    WhyValuableProps,
    'whyValuable' | 'setWhyValuable' | 'verbatimComment' | 'setVerbatimComment'
  >
>) {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-4">
      <h2 className="text-sm font-semibold text-amber-300 uppercase tracking-wide">
        ⭐ Why Was This Valuable?
      </h2>
      <p className="text-xs text-neutral-400">
        This is the most important field — it helps us understand what we&apos;re missing
      </p>
      <WhyInput value={whyValuable} onChange={setWhyValuable} />
      <VerbatimInput value={verbatimComment} onChange={setVerbatimComment} />
      <ExamplesHint />
    </div>
  );
}

type AudienceSelectorProps = Pick<WhyValuableProps, 'suggestedAudiences' | 'toggleAudience'>;

function AudienceButton({
  aud,
  isSelected,
  onClick,
}: Readonly<{
  aud: { value: string; label: string };
  isSelected: boolean;
  onClick: () => void;
}>) {
  const cls = isSelected
    ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
    : 'bg-neutral-800 text-neutral-400 border border-neutral-700 hover:border-neutral-600';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm transition-colors ${cls}`}
    >
      {aud.label}
    </button>
  );
}

function AudienceSelector({ suggestedAudiences, toggleAudience }: Readonly<AudienceSelectorProps>) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 space-y-4">
      <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wide">
        Classification (Optional)
      </h2>
      <fieldset>
        <legend className="block text-sm font-medium text-neutral-300 mb-2">
          Who should see this?
        </legend>
        <div className="flex flex-wrap gap-2">
          {AUDIENCES.map((aud) => (
            <AudienceButton
              key={aud.value}
              aud={aud}
              isSelected={suggestedAudiences.includes(aud.value)}
              onClick={() => toggleAudience(aud.value)}
            />
          ))}
        </div>
      </fieldset>
    </div>
  );
}

export function WhyValuable(props: Readonly<WhyValuableProps>) {
  return (
    <>
      <WhyValuableCard
        whyValuable={props.whyValuable}
        setWhyValuable={props.setWhyValuable}
        verbatimComment={props.verbatimComment}
        setVerbatimComment={props.setVerbatimComment}
      />
      <AudienceSelector
        suggestedAudiences={props.suggestedAudiences}
        toggleAudience={props.toggleAudience}
      />
    </>
  );
}
