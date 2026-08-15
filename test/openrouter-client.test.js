import assert from "node:assert/strict";
import test from "node:test";

import {
  AngleprobeError,
  analyseWithOpenRouter,
  fetchModelCatalog,
  reasoningOptionsFor,
} from "../lib/openrouter-client.js";

const preferences = {
  apiKey: "sk-or-v1-test",
  modelId: "provider/test-model",
  reasoningEffort: "high",
  requireZdr: true,
};

const analysisOutput = {
  overall_assessment: "potential_concerns_found",
  overview: "The claim uses absolute wording without showing its evidence.",
  issues: [{
    type: "language",
    severity: "medium",
    quote: "always",
    quote_occurrence: 1,
    explanation: "Absolute wording can imply more certainty than the passage supports.",
    confidence: "high",
  }],
  missing_context: [{
    item: "The underlying evidence",
    why_it_matters: "It is needed to assess whether the absolute claim is justified.",
  }],
  neutral_rewrite: "This approach often works for 20 people.",
  limitations: ["Only the selected passage was analysed."],
};

test("model catalog keeps compatible text models and their reasoning metadata", async () => {
  const fetchStub = async () => jsonResponse({ data: [
    {
      id: "provider/compatible",
      name: "Compatible",
      context_length: 100_000,
      architecture: { output_modalities: ["text"] },
      supported_parameters: ["structured_outputs", "reasoning"],
      reasoning: { supported_efforts: ["low", "high"], default_effort: "low" },
      pricing: { prompt: "0.000001", completion: "0.000002" },
    },
    {
      id: "provider/no-structure",
      supported_parameters: ["reasoning"],
      architecture: { output_modalities: ["text"] },
    },
    {
      id: "provider/image-only",
      supported_parameters: ["structured_outputs"],
      architecture: { output_modalities: ["image"] },
    },
  ] });

  const catalog = await fetchModelCatalog(fetchStub);
  assert.equal(catalog.length, 1);
  assert.equal(catalog[0].id, "provider/compatible");
  assert.deepEqual(reasoningOptionsFor(catalog[0]), ["low", "high"]);
});

test("analysis sends the user's key, selected model, reasoning, ZDR, and strict schemas", async () => {
  const requests = [];
  const outputs = [analysisOutput, { approved: true, problems: [] }];
  const fetchStub = async (_url, options) => {
    requests.push(options);
    return jsonResponse({
      model: "provider/resolved-model",
      choices: [{ message: { content: JSON.stringify(outputs.shift()) } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });
  };

  const result = await analyseWithOpenRouter(
    { text: "This approach always works for 20 people." },
    preferences,
    fetchStub,
  );

  assert.equal(requests.length, 2);
  for (const request of requests) {
    const body = JSON.parse(request.body);
    assert.equal(request.headers.Authorization, "Bearer sk-or-v1-test");
    assert.equal(body.model, "provider/test-model");
    assert.deepEqual(body.reasoning, { effort: "high", exclude: true });
    assert.deepEqual(body.provider, {
      allow_fallbacks: true,
      require_parameters: true,
      zdr: true,
      data_collection: "deny",
    });
    assert.equal(body.response_format.type, "json_schema");
    assert.equal(body.response_format.json_schema.strict, true);
  }
  assert.equal(result.model.id, "provider/resolved-model");
  assert.equal(result.analysis.issues[0].location.start, 14);
  assert.equal(result.rewrite_audit.approved, true);
  assert.equal(result.usage.requests, 2);
});

test("turning off ZDR omits the ZDR provider constraints", async () => {
  let requestBody;
  const fetchStub = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return jsonResponse({ choices: [{ message: { content: JSON.stringify({
      ...analysisOutput,
      neutral_rewrite: null,
    }) } }] });
  };

  await analyseWithOpenRouter(
    { text: "This approach always works for 20 people." },
    { ...preferences, requireZdr: false, reasoningEffort: "default" },
    fetchStub,
  );

  assert.equal("zdr" in requestBody.provider, false);
  assert.equal("data_collection" in requestBody.provider, false);
  assert.equal("reasoning" in requestBody, false);
});

test("a ZDR routing denial becomes a recoverable, specific error", async () => {
  const fetchStub = async () => jsonResponse(
    { error: { message: "No endpoints available that satisfy ZDR" } },
    403,
  );

  await assert.rejects(
    analyseWithOpenRouter({ text: "Some text" }, preferences, fetchStub),
    (error) => error instanceof AngleprobeError && error.code === "zdr_unavailable",
  );
});

test("invalid structured output is rejected before display", async () => {
  const fetchStub = async () => jsonResponse({
    choices: [{ message: { content: JSON.stringify({ overview: "Missing fields" }) } }],
  });

  await assert.rejects(
    analyseWithOpenRouter({ text: "Some text" }, preferences, fetchStub),
    (error) => error instanceof AngleprobeError && error.code === "invalid_model_output",
  );
});

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
