import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { GitHubPublisher } from "../src/adapters/github-publisher.js";
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
  status: "READY_TO_PUBLISH",
  pendingHumanActions: [],
  generatedAt: "2026-08-29T00:00:00.000Z",
};

const draft: PullRequestDraft = {
  title: "AF-1: Add priority to tasks",
  body: "AgentForge publishes this Pull Request automatically. Merge remains a human-only action.",
  published: false,
};

test("publishes one commit and pull request automatically after checks pass", async () => {
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
  const publisher = new GitHubPublisher({
    token: "secret",
    owner: "edertaveira",
    repository: "AgentForge",
    baseBranch: "main",
    targetDirectory: "examples/taskboard",
  }, request);

  const result = await publisher.publish(workspace, evidence, draft);

  assert.equal(result.number, 2);
  assert.equal(calls.length, 6);
  assert.deepEqual((calls[2]?.body as { tree: Array<{ path: string }> }).tree.map((entry) => entry.path), [
    "examples/taskboard/src/task.js",
    "examples/taskboard/test/task.test.js",
  ]);
  assert.match(calls[4]?.url ?? "", /\/git\/refs$/);
  assert.match(calls[5]?.url ?? "", /\/pulls$/);
  assert.equal(calls.some((call) => call.method === "PUT"), false);
  assert.equal(calls.some((call) => /\/pulls\/\d+\/merge$/.test(call.url)), false);
});

test("rejects publication unless the automated checks reached READY_TO_PUBLISH", async () => {
  const publisher = new GitHubPublisher({
    token: "secret", owner: "edertaveira", repository: "AgentForge",
    baseBranch: "main",
    targetDirectory: "examples/taskboard",
  }, async () => { throw new Error("network must not be called"); });

  await assert.rejects(
    () => publisher.publish("/tmp/unused", { ...evidence, status: "BLOCKED" }, draft),
    /requires READY_TO_PUBLISH evidence/,
  );
});

test("waits for the human merge without calling a merge endpoint", async () => {
  const calls: Array<{ method: string; url: string }> = [];
  const responses = [
    { merged_at: null },
    { merged_at: "2026-10-31T22:00:00Z" },
  ];
  const publisher = new GitHubPublisher({
    token: "secret", owner: "edertaveira", repository: "AgentForge",
    baseBranch: "main",
    targetDirectory: "examples/taskboard",
  }, async (input, init) => {
    calls.push({ method: init?.method ?? "GET", url: input.toString() });
    return Response.json(responses.shift() ?? { merged_at: null });
  });

  const merged = await publisher.waitForMerge(8, { pollIntervalMs: 0, timeoutMs: 100 });

  assert.equal(merged, true);
  assert.deepEqual(calls.map((call) => call.method), ["GET", "GET"]);
  assert.equal(calls.every((call) => call.url.endsWith("/pulls/8")), true);
});
