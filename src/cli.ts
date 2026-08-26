import path from "node:path";
import { fileURLToPath } from "node:url";
import { AgentForgeOrchestrator } from "./orchestrator.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "../..");
const [command, workItemId = "AF-101"] = process.argv.slice(2);

if (command !== "run") {
  console.error("Usage: node dist/src/cli.js run <WORK_ITEM_ID>");
  process.exitCode = 1;
} else {
  const orchestrator = new AgentForgeOrchestrator({
    tasks: path.join(projectRoot, "fixtures/tasks"),
    template: path.join(projectRoot, "examples/taskboard-template"),
    runs: path.join(projectRoot, ".agentforge/runs"),
  });

  const outcome = await orchestrator.run(workItemId);
  console.log(`Run: ${outcome.runId}`);
  console.log(`Status: ${outcome.evidence.status}`);
  console.log(`Tests: ${outcome.evidence.tests.map((test) => test.status).join(", ")}`);
  console.log(`Review: ${outcome.evidence.review.verdict}`);
  console.log(`Workspace: ${outcome.workspace}`);
  console.log("Pull Request: simulated only; human approval is still required.");
}
