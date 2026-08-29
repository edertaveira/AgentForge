import test from "node:test";
import assert from "node:assert/strict";
import { supportsTaskPriorityRecipe } from "../src/agents/implementer.js";
import type { ImplementationBrief, WorkItem } from "../src/domain/contracts.js";

const jiraItem: WorkItem = {
  id: "AF-1",
  title: "Add priority to tasks",
  description: "Add priority to createTask.",
  source: "jira",
  labels: [],
  acceptanceCriteria: [
    { id: "AC-1", text: "Use createTask(title, priority = medium)." },
    { id: "AC-2", text: "Reject unsupported values with invalid priority." },
  ],
  technicalContext: [
    "Implementation is in src/task.js.",
    "Tests are in test/task.test.js.",
  ],
};

const brief: ImplementationBrief = {
  workItemId: "AF-1",
  summary: "Add task priority.",
  facts: [],
  hypotheses: [],
  blockingQuestions: [],
  likelyFiles: ["src/task.js", "test/task.test.js"],
  plan: [],
  risk: "low",
};

test("selects the safe recipe from Jira evidence rather than a hard-coded issue key", () => {
  assert.equal(supportsTaskPriorityRecipe(jiraItem, brief), true);
});

test("rejects a Jira task when the approved file scope does not match the recipe", () => {
  assert.equal(
    supportsTaskPriorityRecipe(jiraItem, { ...brief, likelyFiles: ["src/other.js"] }),
    false,
  );
});
