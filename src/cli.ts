#!/usr/bin/env node

import { existsSync } from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { AgentForgeOrchestrator } from "./orchestrator.js";
import { analysisProviderFromEnvironment, createAnalysisAgent } from "./core/analysis-provider.js";
import { assertSupportedRuntime } from "./core/runtime.js";
import { createTaskBoard, taskSourceFromEnvironment } from "./core/task-source.js";
import { JiraTaskBoard } from "./adapters/jira-task-board.js";
import { GitHubPublisher } from "./adapters/github-publisher.js";
import { githubConfigFromEnvironment } from "./core/github-config.js";
import { markRunCompleted, markRunReadyForMerge } from "./core/published-run.js";
import { WaitingForInputError } from "./core/waiting-for-input.js";
import { assertProjectClean, initializeProject, loadProjectContext } from "./core/project-context.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const toolRoot = path.resolve(here, "../..");
const args = process.argv.slice(2);
const command = args[0];
const projectOption = args.find((argument) => argument.startsWith("--project="));
const projectRoot = path.resolve(projectOption?.slice("--project=".length) || process.cwd());
const commandArgument = args.slice(1).find((argument) => !argument.startsWith("--"));
const deterministicLocal = args.includes("--local");

loadNearestEnvironment(projectRoot);
assertSupportedRuntime();

if (command === "help" || command === "--help" || command === "-h" || !command) {
  printUsage();
} else if (command === "init") {
  const context = await initializeProject(projectRoot);
  console.log(`AgentForge initialized: ${context.configPath}`);
  console.log(`Project: ${context.config.projectName}`);
  console.log(`Repository: ${context.config.repository}`);
  console.log(`Base branch: ${context.config.baseBranch}`);
  console.log(`Repository path: ${context.config.targetDirectory || "."}`);
} else if (["run", "check", "check-jira", "check-github"].includes(command)) {
  const context = deterministicLocal ? undefined : await loadProjectContext(projectRoot);
  const runtimeEnvironment = deterministicLocal
    ? { ...process.env, ANALYSIS_PROVIDER: "local", TASK_SOURCE: "local" }
    : process.env;
  const providerConfig = analysisProviderFromEnvironment(runtimeEnvironment);
  const taskSourceConfig = taskSourceFromEnvironment(runtimeEnvironment);
  const tasksDirectory = path.join(toolRoot, "fixtures/tasks");
  const taskBoard = createTaskBoard(taskSourceConfig, tasksDirectory);
  const workItemId = commandArgument ?? process.env.JIRA_ISSUE_KEY ?? "AF-101";

  if (command === "check" || command === "check-jira") {
    await checkJira(taskBoard, taskSourceConfig.source, workItemId);
  }
  if (command === "check" || command === "check-github") {
    const publisher = new GitHubPublisher(githubConfigFromEnvironment(process.env, context?.config));
    await publisher.checkConnection();
    console.log("GitHub connection: successful");
    console.log("GitHub mode: read-only connection check");
  }
  if (command === "run") {
    const runsDirectory = path.join(context?.projectRoot ?? toolRoot, ".agentforge/runs");
    const template = deterministicLocal ? path.join(toolRoot, "examples/taskboard-baseline") : context?.projectRoot;
    if (!template) throw new Error("Project context is required for an integrated run");
    if (context) assertProjectClean(context);
    const orchestrator = new AgentForgeOrchestrator(
      { tasks: tasksDirectory, template, runs: runsDirectory },
      createAnalysisAgent(providerConfig),
      taskBoard,
    );
    await runDelivery({
      orchestrator,
      workItemId,
      provider: providerConfig.provider,
      source: taskSourceConfig.source,
      runsDirectory,
      taskBoard,
      ...(context ? { githubProject: context.config } : {}),
    });
  }
} else {
  printUsage();
  process.exitCode = 1;
}

async function checkJira(
  taskBoard: ReturnType<typeof createTaskBoard>,
  source: "local" | "jira",
  workItemId: string,
): Promise<void> {
  if (source !== "jira" || !(taskBoard instanceof JiraTaskBoard)) {
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
  const transitions = await taskBoard.getAvailableTransitions(workItemId);
  console.log(`Available transitions: ${transitions.join(", ") || "none"}`);
  console.log("Jira mode: read-only connection check");
}

async function runDelivery(options: {
  orchestrator: AgentForgeOrchestrator;
  workItemId: string;
  provider: "local" | "openai";
  source: "local" | "jira";
  runsDirectory: string;
  taskBoard: ReturnType<typeof createTaskBoard>;
  githubProject?: { repository: string; baseBranch: string; targetDirectory: string };
}): Promise<void> {
  let outcome;
  try {
    outcome = await options.orchestrator.run(options.workItemId);
  } catch (error) {
    if (error instanceof WaitingForInputError) {
      console.log("Status: WAITING_FOR_JIRA_INPUT");
      console.log(`Work item: ${error.workItemId}`);
      console.log("Questions were posted to Jira and the task was flagged for input.");
      return;
    }
    throw error;
  }
  console.log(`Analysis provider: ${options.provider}`);
  console.log(`Task source: ${options.source}`);
  console.log(`Run: ${outcome.runId}`);
  console.log(`Tests: ${outcome.evidence.tests.map((test) => test.status).join(", ")}`);
  console.log(`Review: ${outcome.evidence.review.verdict}`);
  console.log(`Workspace: ${outcome.workspace}`);
  if (options.source !== "jira") {
    console.log(`Status: ${outcome.evidence.status}`);
    console.log("Pull Request: skipped in deterministic local mode.");
    return;
  }
  const publisher = new GitHubPublisher(githubConfigFromEnvironment(process.env, options.githubProject));
  const publication = await publisher.publish(outcome.workspace, outcome.evidence, outcome.pullRequest);
  const finalEvidence = await markRunReadyForMerge(
    options.runsDirectory,
    outcome.runId,
    outcome.evidence,
    publication,
  );
  await options.taskBoard.markReadyForMerge?.(outcome.evidence.workItem, publication);
  console.log(`Status: ${finalEvidence.status}`);
  console.log(`Pull Request: ${publication.url}`);
  console.log(`Branch: ${publication.branch}`);
  console.log("Human action required: merge the Pull Request.");
  console.log("Waiting for GitHub to confirm the merge...");
  const merged = await publisher.waitForMerge(publication.number, {
    pollIntervalMs: secondsFromEnvironment("GITHUB_MERGE_POLL_SECONDS", 5) * 1_000,
    timeoutMs: secondsFromEnvironment("GITHUB_MERGE_WAIT_SECONDS", 1_800) * 1_000,
  });
  if (merged) {
    await options.taskBoard.markDone?.(outcome.evidence.workItem, publication);
    const completedEvidence = await markRunCompleted(
      options.runsDirectory,
      outcome.runId,
      finalEvidence,
      publication,
    );
    console.log(`Status: ${completedEvidence.status}`);
    console.log("Jira: moved to Done after the merge was confirmed.");
  } else {
    console.log("Merge wait timed out. Jira remains in review; the Pull Request was not merged by AgentForge.");
  }
}

function loadNearestEnvironment(start: string): void {
  let directory = path.resolve(start);
  while (true) {
    const candidate = path.join(directory, ".env");
    if (existsSync(candidate)) {
      loadEnvFile(candidate);
      return;
    }
    const parent = path.dirname(directory);
    if (parent === directory) return;
    directory = parent;
  }
}

function printUsage(): void {
  console.log(`AgentForge CLI

Usage:
  agentforge init [--project=PATH]
  agentforge check [WORK_ITEM_ID] [--project=PATH]
  agentforge run [WORK_ITEM_ID] [--project=PATH]

Development fixtures:
  agentforge run AF-101 --local
`);
}

function secondsFromEnvironment(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative number of seconds`);
  }
  return value;
}
