import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createMcpContextTools } from "../src/mcp/context-tools.js";

const projectRoot = process.cwd();

test("MCP context tools read the local work item without network access", async () => {
  const tools = createMcpContextTools({
    projectRoot,
    environment: { TASK_SOURCE: "local" },
  });

  const item = await tools.getWorkItem("AF-101");
  assert.equal(item.source, "local");
  assert.equal(item.acceptanceCriteria.length, 5);
});

test("MCP repository context exposes only the immutable baseline allowlist", async () => {
  const tools = createMcpContextTools({ projectRoot, environment: {} });
  const context = await tools.getRepositoryContext();

  assert.equal(context.root, "examples/taskboard-baseline");
  assert.equal(context.testCommand, "node --test");
  assert.deepEqual(context.files.map((file) => file.path), [
    "package.json",
    "src/task.js",
    "test/task.test.js",
  ]);
  assert.equal(context.policy, "read-only allowlist");
  assert.ok(context.files.every((file) => !path.isAbsolute(file.path)));
});
