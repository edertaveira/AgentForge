import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadStoredRun } from "../src/core/run-artifacts.js";

test("loads a publishable run without requiring a human publication approval", async () => {
  const runs = await mkdtemp(path.join(os.tmpdir(), "agentforge-stored-run-"));
  const runId = "AF-1-2026-08-29T20-26-34-758Z";
  const runRoot = path.join(runs, runId);
  await mkdir(path.join(runRoot, "artifacts"), { recursive: true });
  await mkdir(path.join(runRoot, "workspace"), { recursive: true });
  await writeFile(path.join(runRoot, "artifacts/evidence.json"), JSON.stringify({
    status: "READY_TO_PUBLISH",
  }));
  await writeFile(
    path.join(runRoot, "artifacts/pull-request.md"),
    "# AF-1: Add priority to tasks\n\nAutomated body\n",
  );

  const stored = await loadStoredRun(runs, runId);

  assert.equal(stored.evidence.status, "READY_TO_PUBLISH");
  assert.equal(stored.pullRequest.title, "AF-1: Add priority to tasks");
  assert.equal(stored.pullRequest.body, "Automated body");
  assert.equal(stored.workspace, path.join(runRoot, "workspace"));
});

test("rejects traversal instead of loading an arbitrary run path", async () => {
  await assert.rejects(
    () => loadStoredRun("/tmp/runs", "../../secret"),
    /Invalid run id/,
  );
});
