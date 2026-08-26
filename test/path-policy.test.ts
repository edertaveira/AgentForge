import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { resolveInside } from "../src/core/path-policy.js";

test("resolves a path inside the workspace", () => {
  assert.equal(resolveInside("/tmp/workspace", "src/task.js"), path.resolve("/tmp/workspace/src/task.js"));
});

test("rejects traversal outside the workspace", () => {
  assert.throws(() => resolveInside("/tmp/workspace", "../secret"), /escapes authorized workspace/);
});
