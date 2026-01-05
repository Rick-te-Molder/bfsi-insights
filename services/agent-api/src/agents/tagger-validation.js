/**
 * Tagger Validation Utilities
 *
 * Functions for validating and processing tagged results.
 */

const L1_CATEGORIES = new Set(['banking', 'financial-services', 'insurance']);

/** Extract code from item (handles both string and object formats) */
function getCode(item) {
  return typeof item === 'string' ? item : item.code;
}

/** Extract confidence from item */
function getConfidence(item) {
  return typeof item === 'object' ? item.confidence || 0 : 0;
}

/**
 * Filter tagged codes to only include valid taxonomy codes
 * Logs warnings for invalid codes (LLM hallucinations)
 */
export function validateCodes(taggedItems, validSet, categoryName) {
  if (!taggedItems || !Array.isArray(taggedItems)) return [];

  const nonNullItems = taggedItems.filter((item) => item != null);
  if (nonNullItems.length === 0) {
    console.warn(`   ⚠️ All ${categoryName} codes were null/undefined`);
    return [];
  }

  const validated = [];
  for (const item of nonNullItems) {
    const code = getCode(item);
    if (validSet.has(code)) {
      validated.push(item);
    } else {
      console.warn(`   ⚠️ Invalid ${categoryName} code rejected: "${code}"`);
    }
  }
  return validated;
}

/** Find L1 industry codes from list */
function findL1Codes(industryCodes) {
  return industryCodes.filter((item) => L1_CATEGORIES.has(getCode(item)));
}

/** Sort L1 codes by confidence descending */
function sortByConfidence(codes) {
  return [...codes].sort((a, b) => getConfidence(b) - getConfidence(a));
}

/**
 * Enforce mutual exclusivity for B/FS/I L1 industry categories
 * If multiple L1s are tagged, keep only the highest confidence one
 */
export function enforceIndustryMutualExclusivity(industryCodes) {
  if (!industryCodes || !Array.isArray(industryCodes)) return [];

  const l1Codes = findL1Codes(industryCodes);
  if (l1Codes.length <= 1) return industryCodes;

  const sorted = sortByConfidence(l1Codes);
  const keepCode = getCode(sorted[0]);
  const removeCodes = sorted.slice(1).map(getCode);

  console.warn(
    `   ⚠️ Industry mutual exclusivity: keeping "${keepCode}", removing [${removeCodes.join(', ')}]`,
  );

  return industryCodes.filter((item) => !removeCodes.includes(getCode(item)));
}

/**
 * Conditionally validate based on behavior_type from taxonomy_config
 * GUARDRAIL: Validate against taxonomy list (reject LLM hallucinations)
 * EXPANDABLE: Pass through as-is (LLM can propose new entries)
 */
export function conditionalValidate(codes, validSet, slug, categoryName, behaviorTypes) {
  const behavior = behaviorTypes.get(slug);
  if (behavior === 'expandable') {
    return codes || [];
  }
  return validateCodes(codes, validSet, categoryName);
}

/** Validate all taxonomy codes from result */
function validateAllCodes(result, validCodes, behaviorTypes) {
  const cv = (codes, set, slug, name) => conditionalValidate(codes, set, slug, name, behaviorTypes);
  const industries = enforceIndustryMutualExclusivity(
    cv(result.industry_codes, validCodes.industries, 'industry', 'industry'),
  );

  return {
    industry_codes: industries,
    topic_codes: cv(result.topic_codes, validCodes.topics, 'topic', 'topic'),
    geography_codes: cv(result.geography_codes, validCodes.geographies, 'geography', 'geography'),
    use_case_codes: cv(result.use_case_codes, validCodes.useCases, 'use_case', 'use_case'),
    capability_codes: cv(
      result.capability_codes,
      validCodes.capabilities,
      'capability',
      'capability',
    ),
    regulator_codes: cv(result.regulator_codes, validCodes.regulators, 'regulator', 'regulator'),
    regulation_codes: cv(
      result.regulation_codes,
      validCodes.regulations,
      'regulation',
      'regulation',
    ),
    process_codes: cv(result.process_codes, validCodes.processes, 'process', 'process'),
  };
}

/** Build validated result from raw LLM output */
export function buildValidatedResult(result, validCodes, behaviorTypes, usage) {
  const validatedCodes = validateAllCodes(result, validCodes, behaviorTypes);
  return { ...result, ...validatedCodes, usage };
}
