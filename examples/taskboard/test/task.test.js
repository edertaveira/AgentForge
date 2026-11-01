import test from "node:test";
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
