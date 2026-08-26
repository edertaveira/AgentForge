import test from "node:test";
import assert from "node:assert/strict";
import { ReviewerAgent } from "../src/agents/reviewer.js";
import type { ChangeSet, TestResult, WorkItem } from "../src/domain/contracts.js";

const item: WorkItem = {
  id: "AF-TEST",
  title: "Test review",
  description: "Fixture",
  acceptanceCriteria: [{ id: "AC-1", text: "Tests pass" }],
  labels: [],
  source: "local",
};

const changes: ChangeSet = {
  filesChanged: ["src/task.js", "test/task.test.js"],
  diff: "fixture diff",
  implementationNotes: [],
};

test("blocks a delivery when tests fail", () => {
  const failed: TestResult = {
    command: "node --test",
    status: "failed",
    exitCode: 1,
    output: "one test failed",
  };
  const report = new ReviewerAgent().review(item, changes, [failed]);
  assert.equal(report.verdict, "changes_requested");
  assert.equal(report.acceptanceCoverage[0]?.status, "not_verified");
});

test("approves a delivery with expected files and passing tests", () => {
  const passed: TestResult = {
    command: "node --test",
    status: "passed",
    exitCode: 0,
    output: "all tests passed",
  };
  const report = new ReviewerAgent().review(item, changes, [passed]);
  assert.equal(report.verdict, "approved");
  assert.equal(report.acceptanceCoverage[0]?.status, "satisfied");
});
