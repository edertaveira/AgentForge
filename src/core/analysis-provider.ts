import type { AnalysisAgent } from "../agents/analysis-agent.js";
import { LocalAnalystAgent } from "../agents/analyst.js";
import { OpenAIAnalystAgent } from "../agents/openai-analyst.js";

export type AnalysisProviderName = "local" | "openai";

export interface AnalysisProviderConfig {
  provider: AnalysisProviderName;
  openAIModel?: string;
  openAIKeyPresent?: boolean;
}

export function createAnalysisAgent(config: AnalysisProviderConfig): AnalysisAgent {
  if (config.provider === "local") {
    return new LocalAnalystAgent();
  }

  if (!config.openAIKeyPresent) {
    throw new Error("OPENAI_API_KEY is required when ANALYSIS_PROVIDER=openai");
  }

  return new OpenAIAnalystAgent({
    model: config.openAIModel ?? "gpt-5-mini",
  });
}

export function analysisProviderFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): AnalysisProviderConfig {
  const rawProvider = environment.ANALYSIS_PROVIDER ?? "local";
  if (rawProvider !== "local" && rawProvider !== "openai") {
    throw new Error(`Unsupported ANALYSIS_PROVIDER: ${rawProvider}`);
  }

  return {
    provider: rawProvider,
    ...(environment.OPENAI_MODEL ? { openAIModel: environment.OPENAI_MODEL } : {}),
    openAIKeyPresent: Boolean(environment.OPENAI_API_KEY),
  };
}
