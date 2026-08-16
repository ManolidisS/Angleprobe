const ASSESSMENTS = new Set([
  "no_major_issue_found",
  "potential_concerns_found",
  "insufficient_information",
]);
const ISSUE_TYPES = new Set(["language", "statistics", "potential_factual_issue"]);
const LEVELS = new Set(["low", "medium", "high"]);

export class ModelOutputError extends Error {
  constructor(message) {
    super(message);
    this.name = "ModelOutputError";
  }
}

export function validateAndEnrichAnalysis(value, sourceText) {
  requireObject(value, "analysis");
  requireString(value.overview, "overview", 1, 600);
  requireArray(value.issues, "issues");

  const discarded = [];
  const issues = [];
  for (const [index, issue] of value.issues.slice(0, 12).entries()) {
    const normalized = normalizeIssue(issue, index, sourceText);
    if (normalized) issues.push(normalized);
    else discarded.push(index + 1);
  }

  const missingContext = normalizeMissingContext(value.missing_context);
  const limitations = normalizeLimitations(value.limitations);
  if (discarded.length > 0 && limitations.length < 6) {
    limitations.push(
      `${discarded.length} model suggestion${discarded.length === 1 ? " was" : "s were"} omitted because its quoted text could not be safely matched or its fields were unusable.`,
    );
  }

  let overallAssessment = ASSESSMENTS.has(value.overall_assessment)
    ? value.overall_assessment
    : (issues.length > 0 ? "potential_concerns_found" : "insufficient_information");
  if (issues.length > 0 && overallAssessment === "no_major_issue_found") {
    overallAssessment = "potential_concerns_found";
  } else if (issues.length === 0 && overallAssessment === "potential_concerns_found") {
    overallAssessment = discarded.length > 0 ? "insufficient_information" : "no_major_issue_found";
  }

  return {
    overall_assessment: overallAssessment,
    overview: value.overview,
    issues,
    missing_context: missingContext,
    limitations,
  };
}

function normalizeIssue(issue, index, sourceText) {
  if (issue === null || typeof issue !== "object" || Array.isArray(issue)) return null;
  if (!ISSUE_TYPES.has(issue.type) || !LEVELS.has(issue.severity) || !LEVELS.has(issue.confidence)) return null;
  if (!isStringInRange(issue.quote, 1, 240) || !isStringInRange(issue.explanation, 1, 600)) return null;

  const occurrences = findOccurrences(sourceText, issue.quote);
  if (occurrences.length === 0) return null;
  const requested = Number.isInteger(issue.quote_occurrence) ? issue.quote_occurrence : 1;
  const occurrence = requested >= 1 && requested <= occurrences.length ? requested : 1;
  const start = occurrences[occurrence - 1];
  return {
    id: `issue_${index + 1}`,
    type: issue.type,
    severity: issue.severity,
    quote: issue.quote,
    quote_occurrence: occurrence,
    explanation: issue.explanation,
    confidence: issue.confidence,
    location: { start, end: start + issue.quote.length },
  };
}

function normalizeMissingContext(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).flatMap((item) => {
    if (item === null || typeof item !== "object" || Array.isArray(item)) return [];
    if (!isStringInRange(item.item, 1, 300) || !isStringInRange(item.why_it_matters, 1, 500)) return [];
    return [{ item: item.item, why_it_matters: item.why_it_matters }];
  });
}

function normalizeLimitations(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => isStringInRange(item, 1, 400))
    .slice(0, 6);
}

function findOccurrences(text, quote) {
  const occurrences = [];
  let fromIndex = 0;
  while (occurrences.length < 20) {
    const found = text.indexOf(quote, fromIndex);
    if (found === -1) break;
    occurrences.push(found);
    fromIndex = found + Math.max(quote.length, 1);
  }
  return occurrences;
}

function isStringInRange(value, minimum, maximum) {
  return typeof value === "string" && value.length >= minimum && value.length <= maximum;
}

function requireObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ModelOutputError(`${label} must be an object.`);
  }
}

function requireArray(value, label) {
  if (!Array.isArray(value)) {
    throw new ModelOutputError(`${label} must be an array.`);
  }
}

function requireString(value, label, minimum, maximum) {
  if (typeof value !== "string" || value.length < minimum || value.length > maximum) {
    throw new ModelOutputError(`${label} must contain ${minimum}-${maximum} characters.`);
  }
}
