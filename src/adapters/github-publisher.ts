import { readFile } from "node:fs/promises";
import path from "node:path";
import type { EvidenceBundle, PullRequestDraft, PullRequestPublication } from "../domain/contracts.js";
import type { GitHubConfig } from "../core/github-config.js";
import { resolveInside } from "../core/path-policy.js";

export class GitHubPublisher {
  private readonly apiRoot: string;

  constructor(
    private readonly config: GitHubConfig,
    private readonly request: typeof fetch = fetch,
  ) {
    this.apiRoot = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repository)}`;
  }

  async checkConnection(): Promise<void> {
    await this.github("GET", "");
  }

  async publish(
    workspaceRoot: string,
    evidence: EvidenceBundle,
    draft: PullRequestDraft,
  ): Promise<PullRequestPublication> {
    if (evidence.status !== "READY_TO_PUBLISH" || evidence.review.verdict !== "approved") {
      throw new Error("GitHub publication requires READY_TO_PUBLISH evidence and an approved review");
    }
    if (evidence.tests.some((test) => test.status !== "passed")) {
      throw new Error("GitHub publication requires all recorded tests to pass");
    }

    const allowedFiles = new Set(["src/task.js", "test/task.test.js"]);
    if (!evidence.changes.filesChanged.every((file) => allowedFiles.has(file))) {
      throw new Error("Generated changes exceed the GitHub publishing allowlist");
    }

    const baseRef = await this.githubJson<{ object: { sha: string } }>(
      "GET",
      `/git/ref/heads/${encodeURIComponent(this.config.baseBranch)}`,
    );
    const baseCommit = await this.githubJson<{ tree: { sha: string } }>(
      "GET",
      `/git/commits/${baseRef.object.sha}`,
    );
    const treeEntries = await Promise.all(evidence.changes.filesChanged.map(async (file) => ({
      path: repositoryPath(this.config.targetDirectory, file),
      mode: "100644",
      type: "blob",
      content: await readFile(resolveInside(workspaceRoot, file), "utf8"),
    })));
    const tree = await this.githubJson<{ sha: string }>("POST", "/git/trees", {
      base_tree: baseCommit.tree.sha,
      tree: treeEntries,
    });
    const commit = await this.githubJson<{ sha: string }>("POST", "/git/commits", {
      message: `${evidence.workItem.id}: ${evidence.workItem.title}`,
      tree: tree.sha,
      parents: [baseRef.object.sha],
    });
    const branch = createBranchName(evidence.workItem.id);
    await this.githubJson("POST", "/git/refs", {
      ref: `refs/heads/${branch}`,
      sha: commit.sha,
    });
    const pullRequest = await this.githubJson<{ number: number; html_url: string }>(
      "POST",
      "/pulls",
      {
        title: draft.title,
        body: draft.body,
        head: branch,
        base: this.config.baseBranch,
      },
    );
    return { number: pullRequest.number, url: pullRequest.html_url, branch, commitSha: commit.sha };
  }

  async waitForMerge(
    pullRequestNumber: number,
    options: { pollIntervalMs: number; timeoutMs: number },
  ): Promise<boolean> {
    const startedAt = Date.now();
    while (Date.now() - startedAt <= options.timeoutMs) {
      const pullRequest = await this.githubJson<{ merged_at?: string | null }>(
        "GET",
        `/pulls/${pullRequestNumber}`,
      );
      if (typeof pullRequest.merged_at === "string" && pullRequest.merged_at.length > 0) {
        return true;
      }
      if (options.pollIntervalMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, options.pollIntervalMs));
      }
    }
    return false;
  }

  private async github(method: string, endpoint: string, body?: unknown): Promise<Response> {
    const response = await this.request(`${this.apiRoot}${endpoint}`, {
      method,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.config.token}`,
        "X-GitHub-Api-Version": "2026-03-10",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      throw new Error(`GitHub ${method} ${endpoint || "/"} returned HTTP ${response.status}`);
    }
    return response;
  }

  private async githubJson<T = unknown>(method: string, endpoint: string, body?: unknown): Promise<T> {
    const response = await this.github(method, endpoint, body);
    return response.json() as Promise<T>;
  }
}

function repositoryPath(targetDirectory: string, file: string): string {
  return [targetDirectory.replace(/^\/+|\/+$/g, ""), file.replace(/^\/+/, "")]
    .filter(Boolean)
    .join("/");
}

function createBranchName(workItemId: string): string {
  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
  return `agentforge/${workItemId.toLowerCase()}-${timestamp}`;
}
