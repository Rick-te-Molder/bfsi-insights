export function ClassificationHeader() {
  return (
    <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wide">
      Classification (Optional)
    </h2>
  );
}

export function AudienceChips({
  audiences,
  suggestedAudiences,
  toggleAudience,
}: Readonly<{
  audiences: Array<{ value: string; label: string }>;
  suggestedAudiences: string[];
  toggleAudience: (audience: string) => void;
}>) {
  return (
    <fieldset>
      <legend className="block text-sm font-medium text-neutral-300 mb-2">
        Who should see this?
      </legend>
      <div className="flex flex-wrap gap-2">
        {audiences.map((aud) => (
          <button
            key={aud.value}
            type="button"
            onClick={() => toggleAudience(aud.value)}
            className={`px-3 py-1.5 rounded-full text-sm transition-colors ${suggestedAudiences.includes(aud.value) ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50' : 'bg-neutral-800 text-neutral-400 border border-neutral-700 hover:border-neutral-600'}`}
          >
            {aud.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
