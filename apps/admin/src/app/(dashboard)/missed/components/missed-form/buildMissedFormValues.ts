import type { MissedFormValues } from './useMissedFormValues';

type Args = {
  article: { url: string };
  submitter: {
    submitterName: string;
    submitterAudience: string;
    submitterChannel: string;
    submitterUrgency: string;
  };
  why: { whyValuable: string; verbatimComment: string };
  suggested: { suggestedAudiences: string[] };
};

export function buildMissedFormValues(args: Args): MissedFormValues {
  return {
    url: args.article.url,
    submitterName: args.submitter.submitterName,
    submitterAudience: args.submitter.submitterAudience,
    submitterChannel: args.submitter.submitterChannel,
    submitterUrgency: args.submitter.submitterUrgency,
    whyValuable: args.why.whyValuable,
    verbatimComment: args.why.verbatimComment,
    suggestedAudiences: args.suggested.suggestedAudiences,
  };
}
