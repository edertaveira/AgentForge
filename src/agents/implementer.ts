import type { ApprovalToken, ChangeSet, ImplementationBrief, WorkItem } from "../domain/contracts.js";
import { Workspace } from "../adapters/workspace.js";

const TASK_IMPLEMENTATION = `const ALLOWED_PRIORITIES = new Set(["low", "medium", "high"]);

export function createTask(title, priority = "medium") {
  if (typeof title !== "string" || title.trim() === "") {
    throw new Error("title is required");
  }

  if (!ALLOWED_PRIORITIES.has(priority)) {
    throw new Error(\`invalid priority: \${priority}\`);
  }

  return {
    title: title.trim(),
    status: "open",
    priority,
  };
}
`;

const TASK_TESTS = `import test from "node:test";
import assert from "node:assert/strict";
import { createTask } from "../src/task.js";

test("creates an open task with medium priority by default", () => {
  assert.deepEqual(createTask("Document API"), {
    title: "Document API",
    status: "open",
    priority: "medium",
  });
});

test("accepts an explicit supported priority", () => {
  assert.equal(createTask("Fix production", "high").priority, "high");
});

test("rejects an unsupported priority", () => {
  assert.throws(() => createTask("Guess", "urgent"), /invalid priority/);
});

test("still requires a title", () => {
  assert.throws(() => createTask(""), /title is required/);
});
`;

export class ImplementerAgent {
  async implement(
    item: WorkItem,
    brief: ImplementationBrief,
    workspace: Workspace,
    token: ApprovalToken,
  ): Promise<ChangeSet> {
    if (brief.blockingQuestions.length > 0) {
      throw new Error("Implementation is blocked by unanswered material questions");
    }

    if (!supportsTaskPriorityRecipe(item, brief)) {
      throw new Error(`No safe local implementation recipe for ${item.id}`);
    }

    await workspace.read("src/task.js");
    await workspace.read("test/task.test.js");
    await workspace.write("src/task.js", TASK_IMPLEMENTATION, token);
    await workspace.write("test/task.test.js", TASK_TESTS, token);

    return {
      filesChanged: workspace.changedFiles(),
      diff: workspace.diff(),
      implementationNotes: [
        "Added an allowlist for priority values.",
        "Preserved the existing open status behavior.",
        "Added positive, default, and negative tests.",
      ],
    };
  }
}

export function supportsTaskPriorityRecipe(
  item: WorkItem,
  brief: ImplementationBrief,
): boolean {
  if (item.labels.includes("fixture:task-priority")) {
    return true;
  }

  const taskEvidence = [
    item.title,
    item.description,
    ...item.acceptanceCriteria.map((criterion) => criterion.text),
    ...(item.technicalContext ?? []),
  ].join(" ").toLocaleLowerCase("en-US");
  const requiredEvidence = [
    "createtask",
    "priority",
    "medium",
    "invalid priority",
    "src/task.js",
    "test/task.test.js",
  ];
  const normalizedFiles = new Set(brief.likelyFiles.map((file) => file.replace(/^\.\//, "")));

  return requiredEvidence.every((evidence) => taskEvidence.includes(evidence)) &&
    normalizedFiles.has("src/task.js") &&
    normalizedFiles.has("test/task.test.js");
}
