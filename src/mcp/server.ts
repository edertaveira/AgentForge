import path from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { createMcpContextTools } from "./context-tools.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "../../..");
loadProjectEnvironment(projectRoot);

export function createAgentForgeMcpServer(): McpServer {
  const tools = createMcpContextTools({ projectRoot });
  const server = new McpServer(
    { name: "agentforge-context", version: "0.4.0" },
    { capabilities: { tools: {} } },
  );

  server.registerTool("get_work_item", {
    title: "Get work item",
    description: "Read one configured local or Jira work item by key.",
    inputSchema: z.object({ id: z.string().regex(/^[A-Z][A-Z0-9_]*-\d+$/) }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ id }) => result(await tools.getWorkItem(id)));

  server.registerTool("get_repository_context", {
    title: "Get repository context",
    description: "Read the allowlisted TaskBoard baseline files and test command.",
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async () => result(await tools.getRepositoryContext()));

  server.registerTool("get_run_evidence", {
    title: "Get run evidence",
    description: "Read the bounded evidence summary for one reviewed AgentForge run.",
    inputSchema: z.object({ runId: z.string() }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ runId }) => result(await tools.getRunEvidence(runId)));

  return server;
}

function result(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    structuredContent: value as Record<string, unknown>,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  serveStdio(() => createAgentForgeMcpServer(), {
    onerror: (error) => process.stderr.write(`AgentForge MCP error: ${error.message}\n`),
  });
}

function loadProjectEnvironment(root: string): void {
  try {
    loadEnvFile(path.join(root, ".env"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
