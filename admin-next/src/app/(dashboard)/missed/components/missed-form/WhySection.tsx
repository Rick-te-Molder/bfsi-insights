import { VerbatimField, WhyExamples, WhyHeader, WhyTextarea } from './WhySection.parts';

export function WhySection({
  whyValuable,
  setWhyValuable,
  verbatimComment,
  setVerbatimComment,
}: {
  whyValuable: string;
  setWhyValuable: (v: string) => void;
  verbatimComment: string;
  setVerbatimComment: (v: string) => void;
}) {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-4">
      <WhyHeader />
      <WhyTextarea whyValuable={whyValuable} setWhyValuable={setWhyValuable} />
      <VerbatimField verbatimComment={verbatimComment} setVerbatimComment={setVerbatimComment} />
      <WhyExamples />
    </div>
  );
}
