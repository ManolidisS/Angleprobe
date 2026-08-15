const stringOrNull = {
  anyOf: [{ type: "string", minLength: 1, maxLength: 1_000 }, { type: "null" }],
};

export const ANALYSIS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "overall_assessment",
    "overview",
    "issues",
    "missing_context",
    "neutral_rewrite",
    "limitations",
  ],
  properties: {
    overall_assessment: {
      type: "string",
      enum: [
        "no_major_issue_found",
        "potential_concerns_found",
        "insufficient_information",
      ],
    },
    overview: { type: "string", minLength: 1, maxLength: 600 },
    issues: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "type",
          "severity",
          "quote",
          "quote_occurrence",
          "explanation",
          "confidence",
        ],
        properties: {
          type: {
            type: "string",
            enum: ["language", "statistics", "potential_factual_issue"],
          },
          severity: { type: "string", enum: ["low", "medium", "high"] },
          quote: { type: "string", minLength: 1, maxLength: 240 },
          quote_occurrence: { type: "integer", minimum: 1, maximum: 20 },
          explanation: { type: "string", minLength: 1, maxLength: 600 },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
        },
      },
    },
    missing_context: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["item", "why_it_matters"],
        properties: {
          item: { type: "string", minLength: 1, maxLength: 300 },
          why_it_matters: { type: "string", minLength: 1, maxLength: 500 },
        },
      },
    },
    neutral_rewrite: stringOrNull,
    limitations: {
      type: "array",
      maxItems: 6,
      items: { type: "string", minLength: 1, maxLength: 400 },
    },
  },
};

export const REWRITE_AUDIT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["approved", "problems"],
  properties: {
    approved: { type: "boolean" },
    problems: {
      type: "array",
      maxItems: 8,
      items: { type: "string", minLength: 1, maxLength: 400 },
    },
  },
};
