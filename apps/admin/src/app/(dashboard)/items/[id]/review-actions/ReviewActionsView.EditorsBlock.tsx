import { PublishedDateEditor } from './ReviewActionsView.PublishedDateEditor';
import { TitleField } from './ReviewActionsView.TitleField';

export function EditorsBlock(
  props: Readonly<{
    isEditable: boolean;
    canEditPublishedDate: boolean;
    title: string;
    setTitle: (v: string) => void;
    publishedDate: string;
    setPublishedDate: (v: string) => void;
    loading: string | null;
    onUpdatePublishedDate: () => void;
  }>,
) {
  return (
    <>
      {props.isEditable && <TitleField title={props.title} setTitle={props.setTitle} />}
      {props.canEditPublishedDate && (
        <PublishedDateEditor
          publishedDate={props.publishedDate}
          setPublishedDate={props.setPublishedDate}
          loading={props.loading}
          onSave={props.onUpdatePublishedDate}
        />
      )}
    </>
  );
}
