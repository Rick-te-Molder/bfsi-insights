export function TitleField({
  title,
  setTitle,
}: Readonly<{ title: string; setTitle: (v: string) => void }>) {
  return (
    <div className="mb-4">
      <label htmlFor="title-input" className="block text-sm text-neutral-400 mb-1">
        Title
      </label>
      <input
        id="title-input"
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
      />
    </div>
  );
}
