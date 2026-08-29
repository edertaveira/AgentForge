import path from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { AgentForgeOrchestrator } from "./orchestrator.js";
import {
  analysisProviderFromEnvironment,
  createAnalysisAgent,
} from "./core/analysis-provider.js";
import { assertSupportedRuntime } from "./core/runtime.js";
import { createTaskBoard, taskSourceFromEnvironment } from "./core/task-source.js";
import { JiraTaskBoard } from "./adapters/jira-task-board.js";
import { GitHubPublisher } from "./adapters/github-publisher.js";
import { githubConfigFromEnvironment } from "./core/github-config.js";
import { ApprovalGate } from "./core/approval-gate.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "../..");
try {
  loadEnvFile(path.join(projectRoot, ".env"));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
    throw error;
  }
}
const [command, commandArgument] = process.argv.slice(2);
const commandWorkItemId = commandArgument?.startsWith("--") ? undefined : commandArgument;
const workItemId = commandWorkItemId ?? process.env.JIRA_ISSUE_KEY ?? "AF-101";
const externalWriteApproved = process.argv.slice(2).includes("--approve-external");

assertSupportedRuntime();

if (!["run", "check-jira", "check-github", "publish-github"].includes(command ?? "")) {
  console.error("Usage: node dist/src/cli.js <run|check-jira|check-github|publish-github> [WORK_ITEM_ID] [--approve-external]");
  process.exitCode = 1;
} else {
  const providerConfig = analysisProviderFromEnvironment();
  const taskSourceConfig = taskSourceFromEnvironment();
  const tasksDirectory = path.join(projectRoot, "fixtures/tasks");
  const taskBoard = createTaskBoard(taskSourceConfig, tasksDirectory);

  if (command === "check-github") {
    const gate = new ApprovalGate();
    const publisher = new GitHubPublisher(githubConfigFromEnvironment(), gate);
    await publisher.checkConnection();
    console.log("GitHub connection: successful");
    console.log("Mode: read-only");
    process.exit(0);
  }

  if (command === "check-jira") {
    if (taskSourceConfig.source !== "jira" || !(taskBoard instanceof JiraTaskBoard)) {
      throw new Error("Jira credentials are required to check a Jira work item");
    }
    await taskBoard.checkConnection();
    console.log("Jira authentication: successful");
    const workItem = await taskBoard.getTask(workItemId);
    console.log("Jira connection: successful");
    console.log(`Work item: ${workItem.id}`);
    console.log(`Title: ${workItem.title}`);
    console.log(`Acceptance criteria: ${workItem.acceptanceCriteria.length}`);
    console.log(`Technical context entries: ${workItem.technicalContext?.length ?? 0}`);
    console.log(`Out-of-scope entries: ${workItem.outOfScope?.length ?? 0}`);
    console.log("Mode: read-only");
    process.exit(0);
  }

  const orchestrator = new AgentForgeOrchestrator(
    {
      tasks: tasksDirectory,
      template: path.join(projectRoot, "examples/taskboard-template"),
      runs: path.join(projectRoot, ".agentforge/runs"),
    },
    createAnalysisAgent(providerConfig),
    taskBoard,
  );

  const outcome = await orchestrator.run(workItemId);
  console.log(`Analysis provider: ${providerConfig.provider}`);
  console.log(`Task source: ${taskSourceConfig.source}`);
  console.log(`Run: ${outcome.runId}`);
  console.log(`Status: ${outcome.evidence.status}`);
  console.log(`Tests: ${outcome.evidence.tests.map((test) => test.status).join(", ")}`);
  console.log(`Review: ${outcome.evidence.review.verdict}`);
  console.log(`Workspace: ${outcome.workspace}`);
  if (command === "publish-github") {
    if (!externalWriteApproved) {
      throw new Error("BLOCKED: add --approve-external only after reviewing the generated evidence and diff");
    }
    const gate = new ApprovalGate();
    const config = githubConfigFromEnvironment();
    const request = gate.createRequest({
      action: "external_write",
      reason: `Publish ${outcome.evidence.workItem.id} after human review`,
      scope: [`${config.owner}/${config.repository}`],
    });
    const approval = gate.approve(request, "course-operator");
    const published = await new GitHubPublisher(config, gate).publish(
      outcome.workspace,
      outcome.evidence,
      outcome.pullRequest,
      approval,
    );
    console.log(`Pull Request: ${published.url}`);
    console.log(`Branch: ${published.branch}`);
  } else {
    console.log("Pull Request: simulated only; human approval is still required.");
  }
}
