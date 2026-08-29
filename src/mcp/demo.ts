import path from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import {
  Agent,
  MCPServerStdio,
  createMCPToolStaticFilter,
  run,
} from "@openai/agents";
import { assertSupportedRuntime } from "../core/runtime.js";

assertSupportedRuntime();
const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "../../..");
try {
  loadEnvFile(path.join(projectRoot, ".env"));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
const workItemId = process.env.JIRA_ISSUE_KEY ?? "AF-101";
const server = new MCPServerStdio({
  name: "agentforge-context",
  command: process.execPath,
  args: [path.join(projectRoot, "dist/src/mcp/server.js")],
  cwd: projectRoot,
  cacheToolsList: true,
  toolFilter: createMCPToolStaticFilter({
    allowed: ["get_work_item", "get_repository_context"],
  })!,
});

await server.connect();
try {
  const agent = new Agent({
    name: "AgentForge MCP Inspector",
    model: process.env.OPENAI_MODEL ?? "gpt-5-mini",
    instructions: [
      "Use both MCP tools before answering.",
      "Report the work item id, title, acceptance-criteria count, repository files, and test command.",
      "Do not claim to modify files; these MCP tools are read-only.",
    ].join(" "),
    mcpServers: [server],
    mcpConfig: {
      includeServerInToolNames: true,
      errorFunction: null,
    },
  });
  const output = await run(agent, `Inspect ${workItemId} and its repository context through MCP.`);
  console.log("MCP transport: stdio");
  console.log("MCP tools: get_work_item, get_repository_context");
  console.log(output.finalOutput);
} finally {
  await server.close();
}
