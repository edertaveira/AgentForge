import { spawnSync } from "node:child_process";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";

export interface AgentForgeProjectConfig {
  version: 1;
  projectName: string;
  repository: string;
  baseBranch: string;
  targetDirectory: string;
  testCommand: "node --test";
}

export interface AgentForgeProjectContext {
  projectRoot: string;
  repositoryRoot: string;
  configPath: string;
  config: AgentForgeProjectConfig;
}

export async function initializeProject(projectRoot = process.cwd()): Promise<AgentForgeProjectContext> {
  const absoluteProjectRoot = await realpath(path.resolve(projectRoot));
  const repositoryRoot = await realpath(git(absoluteProjectRoot, ["rev-parse", "--show-toplevel"]));
  const targetDirectory = toPosix(path.relative(repositoryRoot, absoluteProjectRoot));
  const repository = git(absoluteProjectRoot, ["remote", "get-url", "origin"]);
  const baseBranch = detectBaseBranch(absoluteProjectRoot);
  const configPath = path.join(absoluteProjectRoot, ".agentforge/config.json");
  const config: AgentForgeProjectConfig = {
    version: 1,
    projectName: path.basename(absoluteProjectRoot),
    repository,
    baseBranch,
    targetDirectory,
    testCommand: "node --test",
  };

  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return { projectRoot: absoluteProjectRoot, repositoryRoot, configPath, config };
}

export async function loadProjectContext(projectRoot = process.cwd()): Promise<AgentForgeProjectContext> {
  const absoluteProjectRoot = await realpath(path.resolve(projectRoot));
  const configPath = path.join(absoluteProjectRoot, ".agentforge/config.json");
  let raw: string;
  try {
    raw = await readFile(configPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`AgentForge is not initialized in ${absoluteProjectRoot}. Run: agentforge init`);
    }
    throw error;
  }

  const parsed = JSON.parse(raw) as Partial<AgentForgeProjectConfig>;
  if (
    parsed.version !== 1 ||
    typeof parsed.projectName !== "string" ||
    typeof parsed.repository !== "string" ||
    typeof parsed.baseBranch !== "string" ||
    typeof parsed.targetDirectory !== "string" ||
    parsed.testCommand !== "node --test"
  ) {
    throw new Error(`Invalid AgentForge project configuration: ${configPath}`);
  }
  const repositoryRoot = await realpath(git(absoluteProjectRoot, ["rev-parse", "--show-toplevel"]));
  const actualTarget = toPosix(path.relative(repositoryRoot, absoluteProjectRoot));
  if (parsed.targetDirectory !== actualTarget) {
    throw new Error("AgentForge project moved inside the repository. Run agentforge init again.");
  }
  return {
    projectRoot: absoluteProjectRoot,
    repositoryRoot,
    configPath,
    config: parsed as AgentForgeProjectConfig,
  };
}

export function assertProjectClean(context: AgentForgeProjectContext): void {
  const pathspec = context.config.targetDirectory || ".";
  const status = git(context.repositoryRoot, ["status", "--porcelain", "--", pathspec])
    .split("\n")
    .filter(Boolean)
    .filter((line) => !isAgentForgeRuntimePath(line.slice(3), context.config.targetDirectory))
    .join("\n");
  if (status) {
    throw new Error(
      `The target project has uncommitted changes:\n${status}\nCommit or stash them before running AgentForge.`,
    );
  }
}

function isAgentForgeRuntimePath(file: string, targetDirectory: string): boolean {
  const runtime = [targetDirectory, ".agentforge"].filter(Boolean).join("/");
  return file === runtime || file.startsWith(`${runtime}/`);
}

function detectBaseBranch(cwd: string): string {
  const remoteHead = gitOptional(cwd, ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]);
  if (remoteHead?.startsWith("origin/")) return remoteHead.slice("origin/".length);
  return git(cwd, ["branch", "--show-current"]) || "main";
}

function git(cwd: string, args: string[]): string {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout.trim();
}

function gitOptional(cwd: string, args: string[]): string | undefined {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : undefined;
}

function toPosix(value: string): string {
  return value === "" ? "" : value.split(path.sep).join("/");
}
