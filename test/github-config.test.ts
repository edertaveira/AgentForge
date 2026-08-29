import test from "node:test";
import assert from "node:assert/strict";
import { githubConfigFromEnvironment } from "../src/core/github-config.js";

test("loads GitHub configuration with safe defaults", () => {
  assert.deepEqual(githubConfigFromEnvironment({
    GITHUB_TOKEN: "token",
    GITHUB_OWNER: "edertaveira",
    GITHUB_REPO: "AgentForge",
  }), {
    token: "token",
    owner: "edertaveira",
    repository: "AgentForge",
    baseBranch: "main",
    targetPrefix: "examples/taskboard-template",
  });
});

test("rejects incomplete GitHub configuration", () => {
  assert.throws(() => githubConfigFromEnvironment({}), /GITHUB_TOKEN is required/);
});
