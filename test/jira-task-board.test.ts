import test from "node:test";
import assert from "node:assert/strict";
import { JiraTaskBoard } from "../src/adapters/jira-task-board.js";

test("loads and maps a Jira Cloud issue without writing to Jira", async () => {
  let requestedUrl = "";
  let requestedMethod = "";
  const board = new JiraTaskBoard({
    baseUrl: "https://agentforge.atlassian.net/",
    email: "course@example.com",
    apiToken: "secret-token",
    spaceKey: "AF",
    fetch: async (input, init) => {
      requestedUrl = input.toString();
      requestedMethod = init?.method ?? "";
      return Response.json({
        key: "AF-101",
        fields: {
          summary: "Add priority to tasks",
          labels: ["backend", "course"],
          description: {
            type: "doc",
            version: 1,
            content: [
              { type: "paragraph", content: [{ type: "text", text: "Add task priority." }] },
              { type: "heading", content: [{ type: "text", text: "Contexto técnico" }] },
              {
                type: "bulletList",
                content: [
                  { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Implementation is in src/task.js." }] }] },
                  { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Tests are in test/task.test.js." }] }] },
                ],
              },
              { type: "heading", content: [{ type: "text", text: "Critérios de aceite" }] },
              {
                type: "bulletList",
                content: [
                  { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Priority defaults to medium." }] }] },
                  { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Reject invalid values." }] }] },
                ],
              },
              { type: "heading", content: [{ type: "text", text: "Fora do escopo" }] },
              {
                type: "bulletList",
                content: [
                  { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Frontend." }] }] },
                ],
              },
            ],
          },
        },
      });
    },
  });

  const item = await board.getTask("AF-101");

  assert.equal(requestedMethod, "GET");
  assert.match(requestedUrl, /\/rest\/api\/3\/issue\/AF-101/);
  assert.equal(item.source, "jira");
  assert.equal(item.title, "Add priority to tasks");
  assert.deepEqual(item.labels, ["backend", "course"]);
  assert.deepEqual(item.acceptanceCriteria, [
    { id: "AC-1", text: "Priority defaults to medium." },
    { id: "AC-2", text: "Reject invalid values." },
  ]);
  assert.deepEqual(item.technicalContext, [
    "Implementation is in src/task.js.",
    "Tests are in test/task.test.js.",
  ]);
  assert.deepEqual(item.outOfScope, ["Frontend."]);
});

test("reports an authentication hint without exposing credentials", async () => {
  const board = new JiraTaskBoard({
    baseUrl: "https://agentforge.atlassian.net",
    email: "course@example.com",
    apiToken: "secret-token",
    fetch: async () => new Response(null, { status: 401 }),
  });

  await assert.rejects(
    () => board.getTask("AF-101"),
    (error: Error) => {
      assert.match(error.message, /email, API token, and issue permissions/);
      assert.doesNotMatch(error.message, /secret-token/);
      return true;
    },
  );
});

test("checks Jira authentication without exposing profile data", async () => {
  let requestedUrl = "";
  const board = new JiraTaskBoard({
    baseUrl: "https://agentforge.atlassian.net",
    email: "course@example.com",
    apiToken: "secret-token",
    fetch: async (input) => {
      requestedUrl = input.toString();
      return Response.json({ accountId: "hidden" });
    },
  });

  await board.checkConnection();
  assert.equal(requestedUrl, "https://agentforge.atlassian.net/rest/api/3/myself");
});

test("retries through the Atlassian API gateway for a scoped token", async () => {
  const requestedUrls: string[] = [];
  const board = new JiraTaskBoard({
    baseUrl: "https://agentforge.atlassian.net",
    email: "course@example.com",
    apiToken: "scoped-token",
    fetch: async (input) => {
      const url = input.toString();
      requestedUrls.push(url);
      if (url.endsWith("/_edge/tenant_info")) {
        return Response.json({ cloudId: "cloud-123" });
      }
      if (url.startsWith("https://api.atlassian.com/")) {
        return Response.json({ accountId: "hidden" });
      }
      return new Response(null, { status: 401 });
    },
  });

  await board.checkConnection();
  assert.deepEqual(requestedUrls, [
    "https://agentforge.atlassian.net/rest/api/3/myself",
    "https://agentforge.atlassian.net/_edge/tenant_info",
    "https://api.atlassian.com/ex/jira/cloud-123/rest/api/3/myself",
  ]);
});

test("loads an issue through the scoped-token gateway without a separate connection check", async () => {
  const requestedUrls: string[] = [];
  const board = new JiraTaskBoard({
    baseUrl: "https://agentforge.atlassian.net",
    email: "course@example.com",
    apiToken: "scoped-token",
    fetch: async (input) => {
      const url = input.toString();
      requestedUrls.push(url);
      if (url.endsWith("/_edge/tenant_info")) {
        return Response.json({ cloudId: "cloud-123" });
      }
      if (url.startsWith("https://api.atlassian.com/")) {
        return Response.json({
          key: "AF-1",
          fields: {
            summary: "Add priority to tasks",
            description: "",
            labels: [],
          },
        });
      }
      return new Response(null, { status: 401 });
    },
  });

  const item = await board.getTask("AF-1");
  assert.equal(item.id, "AF-1");
  assert.deepEqual(requestedUrls, [
    "https://agentforge.atlassian.net/rest/api/3/issue/AF-1?fields=summary,description,labels",
    "https://agentforge.atlassian.net/_edge/tenant_info",
    "https://api.atlassian.com/ex/jira/cloud-123/rest/api/3/issue/AF-1?fields=summary,description,labels",
  ]);
});

test("rejects an issue outside the configured Jira space", async () => {
  const board = new JiraTaskBoard({
    baseUrl: "https://agentforge.atlassian.net",
    email: "course@example.com",
    apiToken: "secret-token",
    spaceKey: "AF",
  });

  await assert.rejects(() => board.getTask("OTHER-1"), /does not belong to Jira space AF/);
});
