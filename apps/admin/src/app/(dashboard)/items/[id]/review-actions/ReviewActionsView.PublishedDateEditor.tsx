import {
  PublishedDateInput,
  PublishedDateSaveButton,
} from './ReviewActionsView.PublishedDateEditor.parts';

export function PublishedDateEditor({
  publishedDate,
  setPublishedDate,
  loading,
  onSave,
}: {
  publishedDate: string;
  setPublishedDate: (v: string) => void;
  loading: string | null;
  onSave: () => void;
}) {
  return (
    <div className="mb-4">
      <label htmlFor="publication-date-input" className="block text-sm text-neutral-400 mb-1">
        Publication Date
      </label>
      <div className="flex gap-2">
        <PublishedDateInput value={publishedDate} onChange={setPublishedDate} />
        <PublishedDateSaveButton
          disabled={loading !== null || !publishedDate}
          loading={loading}
          onClick={onSave}
        />
      </div>
    </div>
  );
}
