import test from "node:test";
import assert from "node:assert/strict";
import { assertSupportedRuntime } from "../src/core/runtime.js";

test("accepts Node.js 22 and newer", () => {
  assert.doesNotThrow(() => assertSupportedRuntime("22.0.0"));
  assert.doesNotThrow(() => assertSupportedRuntime("24.1.0"));
});

test("rejects unsupported Node.js versions with an actionable message", () => {
  assert.throws(
    () => assertSupportedRuntime("20.10.0"),
    /requires Node\.js 22 or newer; current version is 20\.10\.0/,
  );
});
