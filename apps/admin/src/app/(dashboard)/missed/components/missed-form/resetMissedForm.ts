export type MissedFormResetSetters = {
  setUrl: (v: string) => void;
  setSubmitterName: (v: string) => void;
  setSubmitterAudience: (v: string) => void;
  setWhyValuable: (v: string) => void;
  setVerbatimComment: (v: string) => void;
  setSuggestedAudiences: (v: string[]) => void;
};

export function resetMissedForm(setters: MissedFormResetSetters) {
  setters.setUrl('');
  setters.setSubmitterName('');
  setters.setSubmitterAudience('');
  setters.setWhyValuable('');
  setters.setVerbatimComment('');
  setters.setSuggestedAudiences([]);
}
