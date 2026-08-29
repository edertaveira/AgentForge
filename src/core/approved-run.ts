import { readFile } from "node:fs/promises";
import path from "node:path";
import type { EvidenceBundle, PullRequestDraft } from "../domain/contracts.js";
import { resolveInside } from "./path-policy.js";

export interface ApprovedRun {
  workspace: string;
  evidence: EvidenceBundle;
  pullRequest: PullRequestDraft;
}

export async function loadApprovedRun(runsRoot: string, runId: string): Promise<ApprovedRun> {
  if (!/^[A-Z][A-Z0-9_]*-\d+-\d{4}-\d{2}-\d{2}T[\d-]+Z$/.test(runId)) {
    throw new Error(`Invalid approved run id: ${runId}`);
  }
  const runRoot = resolveInside(runsRoot, runId);
  const evidencePath = resolveInside(runRoot, "artifacts/evidence.json");
  const draftPath = resolveInside(runRoot, "artifacts/pull-request.md");
  const evidence = JSON.parse(await readFile(evidencePath, "utf8")) as EvidenceBundle;
  const markdown = await readFile(draftPath, "utf8");
  const [heading = "", ...bodyParts] = markdown.split("\n");
  const title = heading.replace(/^#\s+/, "").trim();
  if (!title || evidence.status !== "READY_FOR_HUMAN") {
    throw new Error("Approved run is missing a PR title or READY_FOR_HUMAN evidence");
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
