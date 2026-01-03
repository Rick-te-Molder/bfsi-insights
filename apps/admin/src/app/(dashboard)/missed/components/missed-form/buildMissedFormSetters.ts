type Args = {
  article: { setUrl: (v: string) => void };
  submitter: {
    setSubmitterName: (v: string) => void;
    setSubmitterAudience: (v: string) => void;
    setSubmitterChannel: (v: string) => void;
    setSubmitterUrgency: (v: string) => void;
  };
  why: { setWhyValuable: (v: string) => void; setVerbatimComment: (v: string) => void };
  suggested: { setSuggestedAudiences: (v: string[]) => void };
};

export function buildMissedFormSetters(args: Args) {
  return {
    setUrl: args.article.setUrl,
    setSubmitterName: args.submitter.setSubmitterName,
    setSubmitterAudience: args.submitter.setSubmitterAudience,
    setSubmitterChannel: args.submitter.setSubmitterChannel,
    setSubmitterUrgency: args.submitter.setSubmitterUrgency,
    setWhyValuable: args.why.setWhyValuable,
    setVerbatimComment: args.why.setVerbatimComment,
    setSuggestedAudiences: args.suggested.setSuggestedAudiences,
  };
}
