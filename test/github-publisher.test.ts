import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { GitHubPublisher } from "../src/adapters/github-publisher.js";
import { ApprovalGate } from "../src/core/approval-gate.js";
import type { EvidenceBundle, PullRequestDraft } from "../src/domain/contracts.js";

const evidence: EvidenceBundle = {
  workItem: {
    id: "AF-1",
    title: "Add priority to tasks",
    description: "Add task priority.",
    acceptanceCriteria: [{ id: "AC-1", text: "Priority defaults to medium." }],
    labels: [],
    source: "jira",
  },
  brief: {
    workItemId: "AF-1",
    summary: "Add task priority.",
    facts: [], hypotheses: [], blockingQuestions: [],
    likelyFiles: ["src/task.js", "test/task.test.js"],
    plan: [], risk: "low",
  },
  changes: {
    filesChanged: ["src/task.js", "test/task.test.js"],
    diff: "diff",
    implementationNotes: [],
  },
  tests: [{ command: "node --test", status: "passed", exitCode: 0, output: "ok" }],
  review: { verdict: "approved", findings: [], acceptanceCoverage: [] },
  status: "READY_FOR_HUMAN",
  pendingHumanActions: [],
  generatedAt: "2026-08-29T00:00:00.000Z",
};

const draft: PullRequestDraft = {
  title: "AF-1: Add priority to tasks",
  body: "This draft has not been published. Review the diff and evidence before any external write.",
  published: false,
};

test("publishes one commit and pull request only after external approval", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "agentforge-github-"));
  await mkdir(path.join(workspace, "src"), { recursive: true });
  await mkdir(path.join(workspace, "test"), { recursive: true });
  await writeFile(path.join(workspace, "src/task.js"), "export const task = true;\n");
  await writeFile(path.join(workspace, "test/task.test.js"), "// test\n");
  const calls: Array<{ method: string; url: string; body?: unknown }> = [];
  const responses = [
    { object: { sha: "base-commit" } },
    { tree: { sha: "base-tree" } },
    { sha: "new-tree" },
    { sha: "new-commit" },
    { ref: "refs/heads/agentforge/af-1" },
    { number: 2, html_url: "https://github.com/edertaveira/AgentForge/pull/2" },
  ];
  const request: typeof fetch = async (input, init) => {
    calls.push({
      method: init?.method ?? "GET",
      url: input.toString(),
      ...(typeof init?.body === "string" ? { body: JSON.parse(init.body) } : {}),
    });
    return Response.json(responses[calls.length - 1], { status: calls.length >= 3 ? 201 : 200 });
  };
  const gate = new ApprovalGate();
  const approvalRequest = gate.createRequest({
    action: "external_write",
    reason: "test",
    scope: ["edertaveira/AgentForge"],
  });
  const token = gate.approve(approvalRequest, "tester");
  const publisher = new GitHubPublisher({
    token: "secret",
    owner: "edertaveira",
    repository: "AgentForge",
    baseBranch: "main",
    targetPrefix: "examples/taskboard-template",
  }, gate, request);

  const result = await publisher.publish(workspace, evidence, draft, token);

  assert.equal(result.number, 2);
  assert.equal(calls.length, 6);
  assert.deepEqual((calls[2]?.body as { tree: Array<{ path: string }> }).tree.map((entry) => entry.path), [
    "examples/taskboard-template/src/task.js",
    "examples/taskboard-template/test/task.test.js",
  ]);
  assert.match(calls[4]?.url ?? "", /\/git\/refs$/);
  assert.match(calls[5]?.url ?? "", /\/pulls$/);
});

test("rejects publication without repository-scoped external approval", async () => {
  const gate = new ApprovalGate();
  const wrongRequest = gate.createRequest({
    action: "write_workspace",
    reason: "wrong action",
    scope: ["edertaveira/AgentForge"],
  });
  const publisher = new GitHubPublisher({
    token: "secret", owner: "edertaveira", repository: "AgentForge",
    baseBranch: "main", targetPrefix: "examples/taskboard-template",
  }, gate, async () => { throw new Error("network must not be called"); });

  await assert.rejects(
    () => publisher.publish("/tmp/unused", evidence, draft, gate.approve(wrongRequest, "tester")),
    /does not authorize action: external_write/,
  );
});
