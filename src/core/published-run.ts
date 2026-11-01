import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { EvidenceBundle, PullRequestPublication } from "../domain/contracts.js";
import { resolveInside } from "./path-policy.js";

export async function markRunReadyForMerge(
  runsRoot: string,
  runId: string,
  evidence: EvidenceBundle,
  publication: PullRequestPublication,
): Promise<EvidenceBundle> {
  const updated: EvidenceBundle = {
    ...evidence,
    status: "READY_FOR_MERGE",
    pendingHumanActions: ["Merge the Pull Request"],
    publication,
  };
  const artifacts = resolveInside(path.join(runsRoot, runId), "artifacts");
  await writeFile(resolveInside(artifacts, "evidence.json"), JSON.stringify(updated, null, 2));
  await writeFile(resolveInside(artifacts, "publication.json"), JSON.stringify(publication, null, 2));
  return updated;
}

export async function markRunCompleted(
  runsRoot: string,
  runId: string,
  evidence: EvidenceBundle,
  publication: PullRequestPublication,
): Promise<EvidenceBundle> {
  const updated: EvidenceBundle = {
    ...evidence,
    status: "COMPLETED",
    pendingHumanActions: [],
    publication,
  };
  const artifacts = resolveInside(path.join(runsRoot, runId), "artifacts");
  await writeFile(resolveInside(artifacts, "evidence.json"), JSON.stringify(updated, null, 2));
  return updated;
}
