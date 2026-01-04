import { AudienceChips, ClassificationHeader } from './ClassificationSection.parts';

export function ClassificationSection({
  audiences,
  suggestedAudiences,
  toggleAudience,
}: Readonly<{
  audiences: Array<{ value: string; label: string }>;
  suggestedAudiences: string[];
  toggleAudience: (audience: string) => void;
}>) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 space-y-4">
      <ClassificationHeader />
      <AudienceChips
        audiences={audiences}
        suggestedAudiences={suggestedAudiences}
        toggleAudience={toggleAudience}
      />
    </div>
  );
}
