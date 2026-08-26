import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { LocalTaskBoard } from "./adapters/local-task-board.js";
import { Workspace } from "./adapters/workspace.js";
import { AnalystAgent } from "./agents/analyst.js";
import { ImplementerAgent } from "./agents/implementer.js";
import { ReviewerAgent } from "./agents/reviewer.js";
import { TesterAgent } from "./agents/tester.js";
import { ApprovalGate } from "./core/approval-gate.js";
import { createPullRequestDraft } from "./core/pr-draft.js";
import type { EvidenceBundle, PullRequestDraft, RunStatus } from "./domain/contracts.js";

export interface AgentForgePaths {
  tasks: string;
  template: string;
  runs: string;
}

export interface RunOutcome {
  runId: string;
  workspace: string;
  evidence: EvidenceBundle;
  pullRequest: PullRequestDraft;
}

export class AgentForgeOrchestrator {
  private readonly gate = new ApprovalGate();
  private readonly analyst = new AnalystAgent();
  private readonly implementer = new ImplementerAgent();
  private readonly tester = new TesterAgent();
  private readonly reviewer = new ReviewerAgent();

  constructor(private readonly paths: AgentForgePaths) {}

  async run(workItemId: string, approvedBy = "course-operator"): Promise<RunOutcome> {
    let status: RunStatus = "ANALYZING";
    const runId = `${workItemId}-${new Date().toISOString().replaceAll(/[:.]/g, "-")}`;
    const taskBoard = new LocalTaskBoard(this.paths.tasks);
    const workItem = await taskBoard.getTask(workItemId);
    const brief = this.analyst.analyze(workItem);

    if (brief.blockingQuestions.length > 0) {
      throw new Error(`BLOCKED: ${brief.blockingQuestions.join("; ")}`);
    }

    const workspaceRoot = await Workspace.createRun(this.paths.template, this.paths.runs, runId);
    const workspace = new Workspace(workspaceRoot, this.gate);

    status = "AWAITING_IMPLEMENTATION_APPROVAL";
    const request = this.gate.createRequest({
      action: "write_workspace",
      reason: `Implement ${workItem.id} after plan review`,
      scope: brief.likelyFiles,
    });
    const token = this.gate.approve(request, approvedBy);

    status = "IMPLEMENTING";
    const changes = await this.implementer.implement(workItem, brief, workspace, token);
    status = "TESTING";
    const tests = this.tester.test(workspace);
    status = "REVIEWING";
    const review = this.reviewer.review(workItem, changes, tests);
    status = review.verdict === "approved" ? "READY_FOR_HUMAN" : "BLOCKED";

    const evidence: EvidenceBundle = {
      workItem,
      brief,
      changes,
      tests,
      review,
      status,
      pendingHumanActions: ["Inspect the diff", "Approve or reject external Pull Request publication"],
      generatedAt: new Date().toISOString(),
    };
    const pullRequest = createPullRequestDraft(evidence);

    const artifacts = path.join(this.paths.runs, runId, "artifacts");
    await mkdir(artifacts, { recursive: true });
    await writeFile(path.join(artifacts, "evidence.json"), JSON.stringify(evidence, null, 2));
    await writeFile(path.join(artifacts, "pull-request.md"), `# ${pullRequest.title}\n\n${pullRequest.body}\n`);

    return { runId, workspace: workspaceRoot, evidence, pullRequest };
  }
}
