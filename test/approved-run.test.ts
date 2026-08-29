import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadApprovedRun } from "../src/core/approved-run.js";

test("loads the exact READY_FOR_HUMAN run selected for publication", async () => {
  const runs = await mkdtemp(path.join(os.tmpdir(), "agentforge-approved-run-"));
  const runId = "AF-1-2026-08-29T20-26-34-758Z";
  const runRoot = path.join(runs, runId);
  await mkdir(path.join(runRoot, "artifacts"), { recursive: true });
  await mkdir(path.join(runRoot, "workspace"), { recursive: true });
  await writeFile(path.join(runRoot, "artifacts/evidence.json"), JSON.stringify({
    status: "READY_FOR_HUMAN",
  }));
  await writeFile(
    path.join(runRoot, "artifacts/pull-request.md"),
    "# AF-1: Add priority to tasks\n\nReviewed body\n",
  );

  const approved = await loadApprovedRun(runs, runId);

  assert.equal(approved.evidence.status, "READY_FOR_HUMAN");
  assert.equal(approved.pullRequest.title, "AF-1: Add priority to tasks");
  assert.equal(approved.pullRequest.body, "Reviewed body");
  assert.equal(approved.workspace, path.join(runRoot, "workspace"));
});

test("rejects traversal instead of loading an arbitrary run path", async () => {
  await assert.rejects(
    () => loadApprovedRun("/tmp/runs", "../../secret"),
    /Invalid approved run id/,
  );
});
