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
    "https://agentforge.atlassian.net/rest/api/3/issue/AF-1?fields=summary,description,labels,status,comment",
    "https://agentforge.atlassian.net/_edge/tenant_info",
    "https://api.atlassian.com/ex/jira/cloud-123/rest/api/3/issue/AF-1?fields=summary,description,labels,status,comment",
  ]);
});

test("posts blocking questions, applies the input flag, and moves the issue to Blocked", async () => {
  const calls: Array<{ method: string; url: string; body?: unknown }> = [];
  const board = new JiraTaskBoard({
    baseUrl: "https://agentforge.atlassian.net",
    email: "course@example.com",
    apiToken: "secret-token",
    spaceKey: "AF",
    fetch: async (input, init) => {
      const url = input.toString();
      const method = init?.method ?? "GET";
      calls.push({
        method,
        url,
        ...(typeof init?.body === "string" ? { body: JSON.parse(init.body) } : {}),
      });
      if (method === "GET" && url.includes("/issue/AF-1?")) {
        return Response.json({
          key: "AF-1",
          fields: {
            summary: "Ambiguous task",
            description: "Needs clarification",
            labels: [],
            status: { name: "To Do" },
            comment: { comments: [] },
          },
        });
      }
      if (method === "GET" && url.endsWith("/transitions")) {
        return Response.json({ transitions: [
          { id: "31", name: "Block", to: { name: "Blocked" } },
        ] });
      }
      return new Response(null, { status: method === "POST" && url.endsWith("/comment") ? 201 : 204 });
    },
  });

  const item = await board.getTask("AF-1");
  await board.markWaitingForInput(item, ["Which API contract should be used?"]);

  assert.equal(calls.some((call) => call.method === "POST" && call.url.endsWith("/comment")), true);
  assert.equal(calls.some((call) => call.method === "PUT" &&
    JSON.stringify(call.body).includes("agentforge-needs-input")), true);
  assert.equal(calls.some((call) => call.method === "POST" && call.url.endsWith("/transitions") &&
    JSON.stringify(call.body).includes('"31"')), true);
});

test("uses a human Jira reply as technical context on the next run", async () => {
  const board = new JiraTaskBoard({
    baseUrl: "https://agentforge.atlassian.net",
    email: "course@example.com",
    apiToken: "secret-token",
    fetch: async () => Response.json({
      key: "AF-1",
      fields: {
        summary: "Add priority",
        description: "Implement priority",
        labels: ["agentforge-needs-input"],
        status: { name: "Blocked" },
        comment: { comments: [
          { body: { type: "doc", content: [{ type: "paragraph", content: [
            { type: "text", text: "[AgentForge:questions:abc123] Which default?" },
          ] }] } },
          { body: { type: "doc", content: [{ type: "paragraph", content: [
            { type: "text", text: "Use medium as the default." },
          ] }] } },
        ] },
      },
    }),
  });

  const item = await board.getTask("AF-1");

  assert.deepEqual(item.technicalContext, ["Jira clarification: Use medium as the default."]);
});

test("comments the Pull Request and moves the issue to In Review", async () => {
  const calls: Array<{ method: string; url: string; body?: unknown }> = [];
  let transitionLookups = 0;
  const board = new JiraTaskBoard({
    baseUrl: "https://agentforge.atlassian.net",
    email: "course@example.com",
    apiToken: "secret-token",
    fetch: async (input, init) => {
      const url = input.toString();
      const method = init?.method ?? "GET";
      calls.push({
        method,
        url,
        ...(typeof init?.body === "string" ? { body: JSON.parse(init.body) } : {}),
      });
      if (method === "GET" && url.includes("/issue/AF-1?")) {
        return Response.json({
          key: "AF-1",
          fields: {
            summary: "Add priority",
            description: "Implement priority",
            labels: [],
            status: { name: "In Progress" },
            comment: { comments: [] },
          },
        });
      }
      if (method === "GET" && url.endsWith("/transitions")) {
        transitionLookups += 1;
        return Response.json({ transitions: transitionLookups === 1
          ? [{ id: "41", name: "Request review", to: { name: "In Review" } }]
          : [{ id: "51", name: "Complete", to: { name: "Done" } }] });
      }
      return new Response(null, { status: method === "POST" && url.endsWith("/comment") ? 201 : 204 });
    },
  });
  const item = await board.getTask("AF-1");

  const publication = {
    number: 8,
    url: "https://github.com/edertaveira/AgentForge/pull/8",
    branch: "agentforge/af-1-demo",
    commitSha: "abc123",
  };
  await board.markReadyForMerge(item, publication);
  await board.markDone(item, publication);

  assert.equal(calls.some((call) => call.method === "POST" && call.url.endsWith("/comment") &&
    JSON.stringify(call.body).includes("/pull/8")), true);
  assert.equal(calls.some((call) => call.method === "POST" && call.url.endsWith("/transitions") &&
    JSON.stringify(call.body).includes('"41"')), true);
  assert.equal(calls.some((call) => call.method === "POST" && call.url.endsWith("/comment") &&
    JSON.stringify(call.body).includes("AgentForge:completed")), true);
  assert.equal(calls.some((call) => call.method === "POST" && call.url.endsWith("/transitions") &&
    JSON.stringify(call.body).includes('"51"')), true);
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
