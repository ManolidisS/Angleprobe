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
  modelSupportsTools: true,
  reasoningEffort: "high",
  requireZdr: true,
  enableWebVerification: false,
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
  limitations: ["Only the supplied text was analysed."],
};

test("model catalog keeps compatible models and current capability metadata", async () => {
  const fetchStub = async () => jsonResponse({ data: [
    {
      id: "provider/compatible",
      name: "Compatible",
      context_length: 100_000,
      architecture: { output_modalities: ["text"] },
      supported_parameters: ["structured_outputs", "reasoning", "tools"],
      reasoning: { supported_efforts: ["low", "high"], default_effort: "low" },
      pricing: { prompt: "0.000001", completion: "0.000002" },
    },
    {
      id: "provider/no-structure",
      supported_parameters: ["reasoning", "tools"],
      architecture: { output_modalities: ["text"] },
    },
  ] });

  const catalog = await fetchModelCatalog(fetchStub);
  assert.equal(catalog.length, 1);
  assert.equal(catalog[0].id, "provider/compatible");
  assert.equal(catalog[0].supportedParameters.includes("tools"), true);
  assert.deepEqual(reasoningOptionsFor(catalog[0]), ["low", "high"]);
});

test("analysis sends the user's key, model, reasoning, ZDR, and strict schema once", async () => {
  const requests = [];
  const fetchStub = async (_url, options) => {
    requests.push(options);
    return modelResponse(analysisOutput);
  };

  const result = await analyseWithOpenRouter(
    { text: "This approach always works for 20 people.", mode: "selection" },
    preferences,
    fetchStub,
  );

  assert.equal(requests.length, 1);
  const body = JSON.parse(requests[0].body);
  assert.equal(requests[0].headers.Authorization, "Bearer sk-or-v1-test");
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
  assert.equal("tools" in body, false);
  assert.equal("neutral_rewrite" in body.response_format.json_schema.schema.properties, false);
  assert.equal(result.analysis.issues[0].location.start, 14);
  assert.equal(result.usage.requests, 1);
});

test("web verification sends OpenRouter search/fetch tools and captures citations", async () => {
  let requestBody;
  const fetchStub = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return modelResponse(analysisOutput, [{
      type: "url_citation",
      url_citation: { url: "https://example.com/evidence", title: "Primary evidence" },
    }]);
  };

  const result = await analyseWithOpenRouter(
    {
      text: "This approach always works for 20 people.",
      mode: "page",
      source_url: "https://example.com/article",
      source_title: "Article",
    },
    { ...preferences, enableWebVerification: true },
    fetchStub,
  );

  assert.deepEqual(requestBody.tools.map((tool) => tool.type), [
    "openrouter:web_search",
    "openrouter:web_fetch",
  ]);
  assert.equal(result.web_verification, true);
  assert.deepEqual(result.sources, [{ url: "https://example.com/evidence", title: "Primary evidence" }]);
  assert.equal(result.input.capture_mode, "page");
});

test("web verification fails locally for a model without tool support", async () => {
  let called = false;
  await assert.rejects(
    analyseWithOpenRouter(
      { text: "Some text" },
      { ...preferences, enableWebVerification: true, modelSupportsTools: false },
      async () => { called = true; },
    ),
    (error) => error instanceof AngleprobeError && error.code === "tools_unsupported",
  );
  assert.equal(called, false);
});

test("turning off ZDR omits the ZDR provider constraints", async () => {
  let requestBody;
  const fetchStub = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return modelResponse(analysisOutput);
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

test("context-window rejection becomes a useful long-text error", async () => {
  const fetchStub = async () => jsonResponse(
    { error: { message: "Prompt is too long for maximum context length" } },
    400,
  );
  await assert.rejects(
    analyseWithOpenRouter({ text: "A very long page" }, preferences, fetchStub),
    (error) => error instanceof AngleprobeError && error.code === "text_too_long",
  );
});

test("invalid structured output is rejected before display", async () => {
  const fetchStub = async () => modelResponse({ overview: "Missing fields" });
  await assert.rejects(
    analyseWithOpenRouter({ text: "Some text" }, preferences, fetchStub),
    (error) => error instanceof AngleprobeError && error.code === "invalid_model_output",
  );
});

function modelResponse(output, annotations = []) {
  return jsonResponse({
    model: "provider/resolved-model",
    choices: [{ message: { content: JSON.stringify(output), annotations } }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  });
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
