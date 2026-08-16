export const ANALYSIS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "overall_assessment",
    "overview",
    "issues",
    "missing_context",
    "limitations",
  ],
  properties: {
    overall_assessment: {
      type: "string",
      description: "Use potential_concerns_found whenever issues is non-empty; use no_major_issue_found only when issues is empty.",
      enum: [
        "no_major_issue_found",
        "potential_concerns_found",
        "insufficient_information",
      ],
    },
    overview: {
      type: "string",
      description: "A concise, plain-language summary of what the analysis found.",
      minLength: 1,
      maxLength: 600,
    },
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
            description: "The kind of presentation issue found in the exact quoted text.",
            enum: ["language", "statistics", "potential_factual_issue"],
          },
          severity: {
            type: "string",
            description: "How materially this presentation issue could affect interpretation.",
            enum: ["low", "medium", "high"],
          },
          quote: {
            type: "string",
            description: "A verbatim, contiguous substring copied from TEXT, with identical punctuation and whitespace.",
            minLength: 1,
            maxLength: 240,
          },
          quote_occurrence: {
            type: "integer",
            description: "The one-based occurrence number of this exact quote in TEXT.",
            minimum: 1,
            maximum: 20,
          },
          explanation: {
            type: "string",
            description: "A neutral explanation of why the quoted presentation could affect understanding.",
            minLength: 1,
            maxLength: 600,
          },
          confidence: {
            type: "string",
            description: "Confidence that the presentation issue exists, not that the underlying claim is true or false.",
            enum: ["low", "medium", "high"],
          },
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
          item: {
            type: "string",
            description: "Specific absent context that could materially change interpretation.",
            minLength: 1,
            maxLength: 300,
          },
          why_it_matters: {
            type: "string",
            description: "Why this missing context matters to the reader's interpretation.",
            minLength: 1,
            maxLength: 500,
          },
        },
      },
    },
    limitations: {
      type: "array",
      maxItems: 6,
      items: { type: "string", minLength: 1, maxLength: 400 },
    },
  },
};
