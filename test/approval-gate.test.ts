import test from "node:test";
import assert from "node:assert/strict";
import { ApprovalGate } from "../src/core/approval-gate.js";

test("allows a write inside the approved scope", () => {
  const gate = new ApprovalGate();
  const request = gate.createRequest({
    action: "write_workspace",
    reason: "test",
    scope: ["src/task.js"],
  });
  const token = gate.approve(request, "tester");
  assert.doesNotThrow(() => gate.assertAuthorized(token, "write_workspace", "src/task.js"));
});

test("rejects a write outside the approved scope", () => {
  const gate = new ApprovalGate();
  const request = gate.createRequest({
    action: "write_workspace",
    reason: "test",
    scope: ["src/task.js"],
  });
  const token = gate.approve(request, "tester");
  assert.throws(
    () => gate.assertAuthorized(token, "write_workspace", "src/admin.js"),
    /outside approved scope/,
  );
});
