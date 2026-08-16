import assert from "node:assert/strict";
import test from "node:test";

import { validateAndEnrichAnalysis } from "../lib/model-validation.js";

const source = "Always check evidence. Always ask what is missing.";

function analysis(overrides = {}) {
  return {
    overall_assessment: "potential_concerns_found",
    overview: "The passage uses absolute wording.",
    issues: [{
      type: "language",
      severity: "low",
      quote: "Always",
      quote_occurrence: 2,
      explanation: "Absolute wording may imply more certainty than is warranted.",
      confidence: "high",
    }],
    missing_context: [],
    limitations: [],
    ...overrides,
  };
}

test("corrects an impossible occurrence while preserving exact quote matching", () => {
  const result = validateAndEnrichAnalysis(analysis({
    issues: [{ ...analysis().issues[0], quote_occurrence: 9 }],
  }), source);
  assert.equal(result.issues[0].quote_occurrence, 1);
  assert.equal(result.issues[0].location.start, 0);
});

test("drops an unmatchable quote instead of rejecting the entire analysis", () => {
  const result = validateAndEnrichAnalysis(analysis({
    issues: [{ ...analysis().issues[0], quote: "Invented quote" }],
  }), source);
  assert.equal(result.issues.length, 0);
  assert.equal(result.overall_assessment, "insufficient_information");
  assert.match(result.limitations[0], /omitted/i);
});

test("canonicalizes a no-major label when safe issues are present", () => {
  const result = validateAndEnrichAnalysis(analysis({
    overall_assessment: "no_major_issue_found",
    extra_provider_field: "ignored",
  }), source);
  assert.equal(result.overall_assessment, "potential_concerns_found");
  assert.equal("extra_provider_field" in result, false);
});

test("ignores malformed optional context without hiding a valid analysis", () => {
  const result = validateAndEnrichAnalysis(analysis({
    missing_context: [{ item: "Missing why" }, null],
    limitations: [null, "Only the supplied text was analysed."],
  }), source);
  assert.deepEqual(result.missing_context, []);
  assert.deepEqual(result.limitations, ["Only the supplied text was analysed."]);
});
