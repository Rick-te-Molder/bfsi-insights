export function hasAnyTaxonomyTags(payload: Record<string, unknown>) {
  const audienceScores = payload.audience_scores;
  const hasAudiences =
    !!audienceScores &&
    typeof audienceScores === 'object' &&
    Object.keys(audienceScores).length > 0;

  const geos = payload.geography_codes;
  const hasGeographies = Array.isArray(geos) && geos.length > 0;

  const industries = payload.industry_codes;
  const hasIndustries = Array.isArray(industries) && industries.length > 0;

  const topics = payload.topic_codes;
  const hasTopics = Array.isArray(topics) && topics.length > 0;

  return hasAudiences || hasGeographies || hasIndustries || hasTopics;
}
