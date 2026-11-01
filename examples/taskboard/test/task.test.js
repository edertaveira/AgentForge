import test from "node:test";
import assert from "node:assert/strict";
import { createTask } from "../src/task.js";

test("creates an open task", () => {
  assert.deepEqual(createTask("Document API"), {
    title: "Document API",
    status: "open",
  });
});

test("requires a title", () => {
  assert.throws(() => createTask(""), /title is required/);
});
