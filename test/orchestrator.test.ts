import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { LocalTaskBoard } from "../src/adapters/local-task-board.js";
import { AgentForgeOrchestrator } from "../src/orchestrator.js";

const projectRoot = process.cwd();

test("runs the local delivery flow to READY_FOR_HUMAN", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "agentforge-test-"));
  const tasks = path.join(projectRoot, "fixtures/tasks");
  const orchestrator = new AgentForgeOrchestrator(
    {
      tasks,
      template: path.join(projectRoot, "examples/taskboard-baseline"),
      runs: path.join(temporary, "runs"),
    },
    undefined,
    new LocalTaskBoard(tasks),
  );

  const outcome = await orchestrator.run("AF-101", "test-operator");

  assert.equal(outcome.evidence.status, "READY_FOR_HUMAN");
  assert.equal(outcome.evidence.review.verdict, "approved");
  assert.equal(outcome.evidence.tests[0]?.status, "passed");
  assert.equal(outcome.pullRequest.published, false);
  assert.match(outcome.pullRequest.body, /human approval/i);
});
