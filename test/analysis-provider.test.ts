import test from "node:test";
import assert from "node:assert/strict";
import {
  analysisProviderFromEnvironment,
  createAnalysisAgent,
} from "../src/core/analysis-provider.js";
import { LocalAnalystAgent } from "../src/agents/analyst.js";

test("uses the local analysis provider by default", () => {
  const config = analysisProviderFromEnvironment({});
  assert.deepEqual(config, {
    provider: "local",
    openAIKeyPresent: false,
  });
  assert.ok(createAnalysisAgent(config) instanceof LocalAnalystAgent);
});

test("rejects an unsupported analysis provider", () => {
  assert.throws(
    () => analysisProviderFromEnvironment({ ANALYSIS_PROVIDER: "unknown" }),
    /Unsupported ANALYSIS_PROVIDER/,
  );
});

test("requires a key before constructing the OpenAI analyst", () => {
  const config = analysisProviderFromEnvironment({
    ANALYSIS_PROVIDER: "openai",
    OPENAI_MODEL: "gpt-5-mini",
  });
  assert.throws(() => createAnalysisAgent(config), /OPENAI_API_KEY is required/);
});
