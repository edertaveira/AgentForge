import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { ApprovalToken, TestResult } from "../domain/contracts.js";
import { ApprovalGate } from "../core/approval-gate.js";
import { resolveInside } from "../core/path-policy.js";

export class Workspace {
  constructor(
    readonly root: string,
    private readonly approvalGate: ApprovalGate,
  ) {}

  static async createRun(template: string, runsRoot: string, runId: string): Promise<string> {
    const root = path.join(runsRoot, runId, "workspace");
    await mkdir(path.dirname(root), { recursive: true });
    await cp(template, root, { recursive: true });

    runGit(root, ["init", "--quiet"]);
    runGit(root, ["config", "user.email", "agentforge@example.invalid"]);
    runGit(root, ["config", "user.name", "AgentForge Fixture"]);
    runGit(root, ["add", "."]);
    runGit(root, ["commit", "--quiet", "-m", "baseline"]);
    return root;
  }

  async read(relativePath: string): Promise<string> {
    return readFile(resolveInside(this.root, relativePath), "utf8");
  }

  async write(relativePath: string, content: string, token: ApprovalToken): Promise<void> {
    this.approvalGate.assertAuthorized(token, "write_workspace", relativePath);
    const file = resolveInside(this.root, relativePath);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content, "utf8");
  }

  diff(): string {
    return runGit(this.root, ["diff", "--no-ext-diff"]);
  }

  changedFiles(): string[] {
    return runGit(this.root, ["status", "--short"])
      .split("\n")
      .filter(Boolean)
      .map((line) => line.slice(3));
  }

  runAllowed(command: "node --test"): TestResult {
    const result = spawnSync("node", ["--test"], {
      cwd: this.root,
      encoding: "utf8",
      timeout: 30_000,
    });

    return {
      command,
      status: result.status === 0 ? "passed" : "failed",
      exitCode: result.status,
      output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
    };
  }
}

function runGit(cwd: string, args: string[]): string {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout.trimEnd();
}
