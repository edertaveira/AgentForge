import { readFile } from "node:fs/promises";
import path from "node:path";
import type { EvidenceBundle, PullRequestDraft } from "../domain/contracts.js";
import { resolveInside } from "./path-policy.js";

export interface StoredRun {
  workspace: string;
  evidence: EvidenceBundle;
  pullRequest: PullRequestDraft;
}

export async function loadStoredRun(runsRoot: string, runId: string): Promise<StoredRun> {
  if (!/^[A-Z][A-Z0-9_]*-\d+-\d{4}-\d{2}-\d{2}T[\d-]+Z$/.test(runId)) {
    throw new Error(`Invalid run id: ${runId}`);
  }
  const runRoot = resolveInside(runsRoot, runId);
  const evidencePath = resolveInside(runRoot, "artifacts/evidence.json");
  const draftPath = resolveInside(runRoot, "artifacts/pull-request.md");
  const evidence = JSON.parse(await readFile(evidencePath, "utf8")) as EvidenceBundle;
  const markdown = await readFile(draftPath, "utf8");
  const [heading = "", ...bodyParts] = markdown.split("\n");
  const title = heading.replace(/^#\s+/, "").trim();
  if (!title || !["READY_TO_PUBLISH", "READY_FOR_MERGE"].includes(evidence.status)) {
    throw new Error("Stored run is missing a PR title or publishable evidence");
  }
  return {
    workspace: path.join(runRoot, "workspace"),
    evidence,
    pullRequest: {
      title,
      body: bodyParts.join("\n").trim(),
      published: false,
    },
  };
}
