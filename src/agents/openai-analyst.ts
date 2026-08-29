import { Agent, run } from "@openai/agents";
import { z } from "zod";
import type { AnalysisAgent } from "./analysis-agent.js";
import type { ImplementationBrief, WorkItem } from "../domain/contracts.js";

const implementationBriefSchema = z.object({
  workItemId: z.string(),
  summary: z.string(),
  facts: z.array(z.string()),
  hypotheses: z.array(z.string()),
  blockingQuestions: z.array(z.string()),
  likelyFiles: z.array(z.string()),
  plan: z.array(z.string()),
  risk: z.enum(["low", "medium", "high"]),
});

export interface OpenAIAnalystOptions {
  model: string;
}

export class OpenAIAnalystAgent implements AnalysisAgent {
  private readonly agent: Agent<unknown, typeof implementationBriefSchema>;

  constructor(options: OpenAIAnalystOptions) {
    this.agent = new Agent({
      name: "AgentForge Analyst",
      model: options.model,
      instructions: [
        "Analyze software work items before implementation.",
        "Return only claims grounded in the supplied work item.",
        "Keep facts separate from hypotheses.",
        "Use blockingQuestions only for ambiguity that materially changes the implementation.",
        "Do not block on ordinary JavaScript language semantics: a default parameter applies when the argument is omitted or explicitly undefined.",
        "When acceptance criteria require an error message to contain a literal written in backticks or quotes, treat that literal as case-sensitive unless the work item explicitly says otherwise.",
        "Do not ask speculative edge-case questions when the requested signature, allowed values, default, error behavior, target files, and test command are already explicit.",
        "Prefer a small, reversible plan and name only likely files, never invented confirmed files.",
        "Do not claim repository inspection because this agent receives only the work item.",
      ].join(" "),
      outputType: implementationBriefSchema,
    });
  }

  async analyze(item: WorkItem): Promise<ImplementationBrief> {
    const result = await run(
      this.agent,
      [
        "Analyze this work item for a supervised coding workflow.",
        "If the acceptance criteria are insufficient, add a blocking question instead of guessing.",
        JSON.stringify(item, null, 2),
      ].join("\n\n"),
      { maxTurns: 3 },
    );

    if (!result.finalOutput) {
      throw new Error("OpenAI analyst completed without a structured final output");
    }

    if (result.finalOutput.workItemId !== item.id) {
      throw new Error(
        `OpenAI analyst returned workItemId ${result.finalOutput.workItemId} for ${item.id}`,
      );
    }

    return result.finalOutput;
  }
}
