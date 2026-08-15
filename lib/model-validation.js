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
  requireExactKeys(value, [
    "overall_assessment",
    "overview",
    "issues",
    "missing_context",
    "neutral_rewrite",
    "limitations",
  ], "analysis");

  if (!ASSESSMENTS.has(value.overall_assessment)) {
    throw new ModelOutputError("Invalid overall_assessment.");
  }
  requireString(value.overview, "overview", 1, 600);
  requireArray(value.issues, "issues", 12);
  requireArray(value.missing_context, "missing_context", 8);
  requireArray(value.limitations, "limitations", 6);

  if (value.neutral_rewrite !== null) {
    requireString(value.neutral_rewrite, "neutral_rewrite", 1, 1_000);
  }

  const issues = value.issues.map((issue, index) => {
    const label = `issues[${index}]`;
    requireObject(issue, label);
    requireExactKeys(issue, [
      "type",
      "severity",
      "quote",
      "quote_occurrence",
      "explanation",
      "confidence",
    ], label);
    if (!ISSUE_TYPES.has(issue.type)) throw new ModelOutputError(`${label}.type is invalid.`);
    if (!LEVELS.has(issue.severity)) throw new ModelOutputError(`${label}.severity is invalid.`);
    if (!LEVELS.has(issue.confidence)) throw new ModelOutputError(`${label}.confidence is invalid.`);
    requireString(issue.quote, `${label}.quote`, 1, 240);
    requireString(issue.explanation, `${label}.explanation`, 1, 600);
    if (!Number.isInteger(issue.quote_occurrence) || issue.quote_occurrence < 1 || issue.quote_occurrence > 20) {
      throw new ModelOutputError(`${label}.quote_occurrence is invalid.`);
    }

    const start = findOccurrence(sourceText, issue.quote, issue.quote_occurrence);
    if (start === -1) {
      throw new ModelOutputError(`${label}.quote does not occur at the stated occurrence.`);
    }

    return {
      id: `issue_${index + 1}`,
      ...issue,
      location: { start, end: start + issue.quote.length },
    };
  });

  const missingContext = value.missing_context.map((item, index) => {
    const label = `missing_context[${index}]`;
    requireObject(item, label);
    requireExactKeys(item, ["item", "why_it_matters"], label);
    requireString(item.item, `${label}.item`, 1, 300);
    requireString(item.why_it_matters, `${label}.why_it_matters`, 1, 500);
    return item;
  });

  value.limitations.forEach((item, index) =>
    requireString(item, `limitations[${index}]`, 1, 400),
  );

  if (value.overall_assessment === "no_major_issue_found" && issues.length > 0) {
    throw new ModelOutputError("A no-major-issue assessment cannot contain issues.");
  }
  if (
    value.overall_assessment === "no_major_issue_found" &&
    value.neutral_rewrite !== null
  ) {
    throw new ModelOutputError("A no-major-issue assessment cannot contain a neutral rewrite.");
  }

  return { ...value, issues, missing_context: missingContext };
}

export function validateRewriteAudit(value) {
  requireObject(value, "rewrite_audit");
  requireExactKeys(value, ["approved", "problems"], "rewrite_audit");
  if (typeof value.approved !== "boolean") {
    throw new ModelOutputError("rewrite_audit.approved must be boolean.");
  }
  requireArray(value.problems, "rewrite_audit.problems", 8);
  value.problems.forEach((item, index) =>
    requireString(item, `rewrite_audit.problems[${index}]`, 1, 400),
  );
  if (value.approved && value.problems.length > 0) {
    throw new ModelOutputError("An approved rewrite cannot contain problems.");
  }
  return value;
}

export function rewritePreservesNumbers(original, rewrite) {
  const numberPattern = /(?<![\p{L}\p{N}])[-+]?\d+(?:[.,]\d+)*(?:%|\b)/gu;
  const originalNumbers = original.match(numberPattern) ?? [];
  const rewriteNumbers = rewrite.match(numberPattern) ?? [];
  return JSON.stringify(originalNumbers) === JSON.stringify(rewriteNumbers);
}

function findOccurrence(text, quote, occurrence) {
  let fromIndex = 0;
  let found = -1;
  for (let count = 0; count < occurrence; count += 1) {
    found = text.indexOf(quote, fromIndex);
    if (found === -1) return -1;
    fromIndex = found + quote.length;
  }
  return found;
}

function requireObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ModelOutputError(`${label} must be an object.`);
  }
}

function requireExactKeys(value, keys, label) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new ModelOutputError(`${label} has missing or unexpected fields.`);
  }
}

function requireArray(value, label, maximum) {
  if (!Array.isArray(value) || value.length > maximum) {
    throw new ModelOutputError(`${label} must be an array with at most ${maximum} items.`);
  }
}

function requireString(value, label, minimum, maximum) {
  if (typeof value !== "string" || value.length < minimum || value.length > maximum) {
    throw new ModelOutputError(`${label} must contain ${minimum}-${maximum} characters.`);
  }
}
