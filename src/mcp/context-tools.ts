import { readFile } from "node:fs/promises";
import path from "node:path";
import type { WorkItem } from "../domain/contracts.js";
import { createTaskBoard, taskSourceFromEnvironment } from "../core/task-source.js";
import { loadApprovedRun } from "../core/approved-run.js";
import { resolveInside } from "../core/path-policy.js";

export interface McpContextToolsOptions {
  projectRoot: string;
  environment?: NodeJS.ProcessEnv;
}

export function createMcpContextTools(options: McpContextToolsOptions) {
  const environment = options.environment ?? process.env;
  return {
    async getWorkItem(id: string): Promise<WorkItem> {
      const fixtures = path.join(options.projectRoot, "fixtures/tasks");
      return createTaskBoard(taskSourceFromEnvironment(environment), fixtures).getTask(id);
    },

    async getRepositoryContext() {
      const baseline = path.join(options.projectRoot, "examples/taskboard-baseline");
      const allowedFiles = ["package.json", "src/task.js", "test/task.test.js"];
      const files = await Promise.all(allowedFiles.map(async (file) => ({
        path: file,
        content: await readFile(resolveInside(baseline, file), "utf8"),
      })));
      return {
        root: "examples/taskboard-baseline",
        testCommand: "node --test",
        files,
        policy: "read-only allowlist",
      };
    },

    async getRunEvidence(runId: string) {
      const run = await loadApprovedRun(path.join(options.projectRoot, ".agentforge/runs"), runId);
      return {
        workItemId: run.evidence.workItem.id,
        status: run.evidence.status,
        filesChanged: run.evidence.changes.filesChanged,
        tests: run.evidence.tests.map(({ command, status, exitCode }) => ({ command, status, exitCode })),
        review: run.evidence.review.verdict,
        pendingHumanActions: run.evidence.pendingHumanActions,
      };
    },
  };
}
