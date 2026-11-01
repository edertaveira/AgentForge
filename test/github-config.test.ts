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
    targetDirectory: "",
  });
});

test("rejects incomplete GitHub configuration", () => {
  assert.throws(() => githubConfigFromEnvironment({}), /GITHUB_TOKEN is required/);
});

test("uses the initialized project path instead of an environment target prefix", () => {
  const config = githubConfigFromEnvironment({
    GITHUB_TOKEN: "token",
    GITHUB_OWNER: "edertaveira",
    GITHUB_REPO: "AgentForge",
  }, {
    repository: "https://github.com/edertaveira/AgentForge.git",
    baseBranch: "develop",
    targetDirectory: "apps/taskboard",
  });

  assert.equal(config.baseBranch, "develop");
  assert.equal(config.targetDirectory, "apps/taskboard");
});

test("infers GitHub owner and repository from an initialized project", () => {
  const config = githubConfigFromEnvironment({ GITHUB_TOKEN: "token" }, {
    repository: "git@github.com:edertaveira/AgentForge.git",
    baseBranch: "main",
    targetDirectory: "",
  });

  assert.equal(config.owner, "edertaveira");
  assert.equal(config.repository, "AgentForge");
});
