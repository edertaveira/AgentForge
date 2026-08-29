import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ApprovalToken, EvidenceBundle, PullRequestDraft } from "../domain/contracts.js";
import type { GitHubConfig } from "../core/github-config.js";
import { ApprovalGate } from "../core/approval-gate.js";
import { resolveInside } from "../core/path-policy.js";

export interface PublishedPullRequest {
  number: number;
  url: string;
  branch: string;
  commitSha: string;
}

export class GitHubPublisher {
  private readonly apiRoot: string;

  constructor(
    private readonly config: GitHubConfig,
    private readonly gate: ApprovalGate,
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
    token: ApprovalToken,
  ): Promise<PublishedPullRequest> {
    const repositoryScope = `${this.config.owner}/${this.config.repository}`;
    this.gate.assertAuthorized(token, "external_write", repositoryScope);
    if (evidence.status !== "READY_FOR_HUMAN" || evidence.review.verdict !== "approved") {
      throw new Error("GitHub publication requires READY_FOR_HUMAN evidence and an approved review");
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
      path: `${this.config.targetPrefix}/${file}`,
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
        body: draft.body.replace(
          "This draft has not been published. Review the diff and evidence before any external write.",
          "Published after explicit external-write approval. Merge still requires human review.",
        ),
        head: branch,
        base: this.config.baseBranch,
      },
    );
    return { number: pullRequest.number, url: pullRequest.html_url, branch, commitSha: commit.sha };
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

function createBranchName(workItemId: string): string {
  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
  return `agentforge/${workItemId.toLowerCase()}-${timestamp}`;
}
