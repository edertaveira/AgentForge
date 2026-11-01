import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { markRunCompleted, markRunReadyForMerge } from "../src/core/published-run.js";
import type { EvidenceBundle } from "../src/domain/contracts.js";

test("records publication and leaves only merge as a human action", async () => {
  const runs = await mkdtemp(path.join(os.tmpdir(), "agentforge-published-run-"));
  const runId = "AF-1-2026-10-31T10-00-00-000Z";
  await mkdir(path.join(runs, runId, "artifacts"), { recursive: true });
  const evidence: EvidenceBundle = {
    workItem: {
      id: "AF-1",
      title: "Add priority",
      description: "Add priority to tasks",
      acceptanceCriteria: [],
      labels: [],
      source: "jira",
    },
    brief: {
      workItemId: "AF-1",
      summary: "Add priority",
      facts: [],
      hypotheses: [],
      blockingQuestions: [],
      likelyFiles: [],
      plan: [],
      risk: "low",
    },
    changes: { filesChanged: [], diff: "", implementationNotes: [] },
    tests: [],
    review: { verdict: "approved", findings: [], acceptanceCoverage: [] },
    status: "READY_TO_PUBLISH",
    pendingHumanActions: [],
    generatedAt: "2026-10-31T10:00:00.000Z",
  };
  const publication = {
    number: 7,
    url: "https://github.com/edertaveira/AgentForge/pull/7",
    branch: "agentforge/af-1-demo",
    commitSha: "abc123",
  };

  const updated = await markRunReadyForMerge(runs, runId, evidence, publication);

  assert.equal(updated.status, "READY_FOR_MERGE");
  assert.deepEqual(updated.pendingHumanActions, ["Merge the Pull Request"]);
  assert.deepEqual(updated.publication, publication);
  const stored = JSON.parse(await readFile(path.join(runs, runId, "artifacts/evidence.json"), "utf8"));
  assert.equal(stored.status, "READY_FOR_MERGE");
  assert.equal(stored.publication.url, publication.url);

  const completed = await markRunCompleted(runs, runId, updated, publication);
  assert.equal(completed.status, "COMPLETED");
  assert.deepEqual(completed.pendingHumanActions, []);
});
