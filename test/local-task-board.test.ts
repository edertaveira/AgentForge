import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { LocalTaskBoard } from "../src/adapters/local-task-board.js";

test("loads a valid local work item", async () => {
  const board = new LocalTaskBoard(path.join(process.cwd(), "fixtures/tasks"));
  const item = await board.getTask("AF-101");
  assert.equal(item.id, "AF-101");
  assert.equal(item.acceptanceCriteria.length, 5);
  assert.ok(item.technicalContext?.some((entry) => entry.includes("src/task.js")));
  assert.match(item.description, /createTask\(title, priority = 'medium'\)/);
  assert.ok(item.outOfScope?.includes("frontend or UI changes"));
});

test("rejects an invalid work item id before reading the filesystem", async () => {
  const board = new LocalTaskBoard(path.join(process.cwd(), "fixtures/tasks"));
  await assert.rejects(() => board.getTask("../../secret"), /Invalid work item id/);
});
