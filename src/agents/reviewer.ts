import type {
  ChangeSet,
  ReviewReport,
  TestResult,
  WorkItem,
} from "../domain/contracts.js";

export class ReviewerAgent {
  review(item: WorkItem, changes: ChangeSet, tests: TestResult[]): ReviewReport {
    const testsPassed = tests.length > 0 && tests.every((test) => test.status === "passed");
    const hasExpectedFiles = ["src/task.js", "test/task.test.js"].every((file) =>
      changes.filesChanged.includes(file),
    );

    const acceptanceCoverage = item.acceptanceCriteria.map((criterion) => ({
      criterionId: criterion.id,
      status: testsPassed && hasExpectedFiles ? ("satisfied" as const) : ("not_verified" as const),
      evidence: testsPassed
        ? `node --test passed; diff includes ${changes.filesChanged.join(", ")}`
        : "Automated tests did not provide passing evidence.",
    }));

    const findings = [];
    if (!hasExpectedFiles) {
      findings.push({
        severity: "error" as const,
        message: "Expected implementation and test files were not both changed.",
        evidence: changes.filesChanged.join(", "),
      });
    }
    if (!testsPassed) {
      findings.push({
        severity: "error" as const,
        message: "The requested test command did not pass.",
        evidence: tests.map((test) => `${test.command}: ${test.status}`).join("; "),
      });
    }

    return {
      verdict: findings.some((finding) => finding.severity === "error")
        ? "changes_requested"
        : "approved",
      findings,
      acceptanceCoverage,
    };
  }
}
