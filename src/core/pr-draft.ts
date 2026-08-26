import type { EvidenceBundle, PullRequestDraft } from "../domain/contracts.js";

export function createPullRequestDraft(evidence: EvidenceBundle): PullRequestDraft {
  const tests = evidence.tests
    .map((test) => `- ${test.command}: ${test.status}`)
    .join("\n");
  const files = evidence.changes.filesChanged.map((file) => `- ${file}`).join("\n");

  return {
    title: `${evidence.workItem.id}: ${evidence.workItem.title}`,
    body: [
      "## Summary",
      evidence.brief.summary,
      "",
      "## Changed files",
      files,
      "",
      "## Tests actually executed",
      tests,
      "",
      "## Review",
      `Verdict: ${evidence.review.verdict}`,
      "",
      "## Human approval",
      "This draft has not been published. Review the diff and evidence before any external write.",
    ].join("\n"),
    published: false,
  };
}
