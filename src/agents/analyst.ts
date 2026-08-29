import type { AnalysisAgent } from "./analysis-agent.js";
import type { ImplementationBrief, WorkItem } from "../domain/contracts.js";

export class LocalAnalystAgent implements AnalysisAgent {
  async analyze(item: WorkItem): Promise<ImplementationBrief> {
    const hasAcceptanceCriteria = item.acceptanceCriteria.length > 0;

    return {
      workItemId: item.id,
      summary: `Implement ${item.title.toLowerCase()} in the TaskBoard fixture.`,
      facts: [
        `The task has ${item.acceptanceCriteria.length} acceptance criteria.`,
        "The target project is a local JavaScript fixture with Node.js tests.",
        "External writes are outside the implementation scope.",
      ],
      hypotheses: [
        "The task model and its tests are the smallest relevant change surface.",
      ],
      blockingQuestions: hasAcceptanceCriteria ? [] : ["What behavior must be accepted?"],
      likelyFiles: ["src/task.js", "test/task.test.js"],
      plan: [
        "Inspect the current task factory and tests.",
        "Add priority normalization without changing existing defaults other than the requested field.",
        "Add tests for explicit, default, and invalid priority values.",
        "Run the complete fixture test suite.",
      ],
      risk: "low",
    };
  }
}
