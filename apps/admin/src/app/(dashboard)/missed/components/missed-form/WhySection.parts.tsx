export function WhyHeader() {
  return (
    <>
      <h2 className="text-sm font-semibold text-amber-300 uppercase tracking-wide">
        ⭐ Why Was This Valuable?
      </h2>
      <p className="text-xs text-neutral-400">
        This is the most important field — it helps us understand what we&apos;re missing
      </p>
    </>
  );
}

export function WhyTextarea({
  whyValuable,
  setWhyValuable,
}: {
  whyValuable: string;
  setWhyValuable: (v: string) => void;
}) {
  return (
    <div>
      <label htmlFor="why" className="block text-sm font-medium text-neutral-300 mb-2">
        Why did they send this? What makes it valuable? <span className="text-red-400">*</span>
      </label>
      <textarea
        id="why"
        value={whyValuable}
        onChange={(e) => setWhyValuable(e.target.value)}
        required
        rows={3}
        placeholder="Board meeting next week on this topic... Client said 'this is exactly what we needed'..."
        className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3 text-white placeholder-neutral-500 focus:border-amber-500 focus:outline-none"
      />
    </div>
  );
}

export function VerbatimField({
  verbatimComment,
  setVerbatimComment,
}: {
  verbatimComment: string;
  setVerbatimComment: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-300 mb-2">
        Their exact words (optional)
      </label>
      <input
        type="text"
        value={verbatimComment}
        onChange={(e) => setVerbatimComment(e.target.value)}
        placeholder='"This is the kind of content that makes us look smart"'
        className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-white placeholder-neutral-500 focus:border-sky-500 focus:outline-none"
      />
    </div>
  );
}

export function WhyExamples() {
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
