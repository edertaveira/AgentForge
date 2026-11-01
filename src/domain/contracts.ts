export type RiskLevel = "low" | "medium" | "high";
export type RunStatus =
  | "ANALYZING"
  | "AWAITING_IMPLEMENTATION_APPROVAL"
  | "IMPLEMENTING"
  | "TESTING"
  | "REVIEWING"
  | "READY_TO_PUBLISH"
  | "READY_FOR_MERGE"
  | "COMPLETED"
  | "BLOCKED";

export interface AcceptanceCriterion {
  id: string;
  text: string;
}

export interface WorkItem {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: AcceptanceCriterion[];
  labels: string[];
  source: "local" | "jira";
  technicalContext?: string[];
  outOfScope?: string[];
}

export interface ImplementationBrief {
  workItemId: string;
  summary: string;
  facts: string[];
  hypotheses: string[];
  blockingQuestions: string[];
  likelyFiles: string[];
  plan: string[];
  risk: RiskLevel;
}

export interface ApprovalRequest {
  id: string;
  action: "write_workspace";
  reason: string;
  scope: string[];
}

export interface ApprovalToken {
  requestId: string;
  action: ApprovalRequest["action"];
  scope: string[];
  approvedBy: string;
  approvedAt: string;
}

export interface ChangeSet {
  filesChanged: string[];
  diff: string;
  implementationNotes: string[];
}

export interface TestResult {
  command: string;
  status: "passed" | "failed" | "not_run";
  exitCode: number | null;
  output: string;
}

export interface ReviewFinding {
  severity: "info" | "warning" | "error";
  message: string;
  evidence: string;
}

export interface ReviewReport {
  verdict: "approved" | "changes_requested";
  findings: ReviewFinding[];
  acceptanceCoverage: Array<{
    criterionId: string;
    status: "satisfied" | "not_satisfied" | "not_verified";
    evidence: string;
  }>;
}

export interface EvidenceBundle {
  workItem: WorkItem;
  brief: ImplementationBrief;
  changes: ChangeSet;
  tests: TestResult[];
  review: ReviewReport;
  status: RunStatus;
  pendingHumanActions: string[];
  publication?: PullRequestPublication;
  generatedAt: string;
}

export interface PullRequestPublication {
  number: number;
  url: string;
  branch: string;
  commitSha: string;
}

export interface PullRequestDraft {
  title: string;
  body: string;
  published: false;
}
