import test from "node:test";
import assert from "node:assert/strict";
import { taskSourceFromEnvironment } from "../src/core/task-source.js";

test("uses the local source by default", () => {
  assert.deepEqual(taskSourceFromEnvironment({}), { source: "local" });
});

test("loads Jira source configuration from the environment", () => {
  assert.deepEqual(
    taskSourceFromEnvironment({
      TASK_SOURCE: "jira",
      JIRA_BASE_URL: "https://agentforge.atlassian.net",
      JIRA_EMAIL: "course@example.com",
      JIRA_API_TOKEN: "secret-token",
      JIRA_SPACE_KEY: "AF",
    }),
    {
      source: "jira",
      jira: {
        baseUrl: "https://agentforge.atlassian.net",
        email: "course@example.com",
        apiToken: "secret-token",
        spaceKey: "AF",
      },
    },
  );
});

test("selects Jira automatically when all Jira credentials are configured", () => {
  const config = taskSourceFromEnvironment({
    JIRA_BASE_URL: "https://agentforge.atlassian.net",
    JIRA_EMAIL: "course@example.com",
    JIRA_API_TOKEN: "secret-token",
  });

  assert.equal(config.source, "jira");
});

test("fails early when a Jira credential is missing", () => {
  assert.throws(
    () => taskSourceFromEnvironment({ TASK_SOURCE: "jira" }),
    /JIRA_BASE_URL is required/,
  );
});
