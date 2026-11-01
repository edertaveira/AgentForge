import { createHash } from "node:crypto";
import type { AcceptanceCriterion, PullRequestPublication, WorkItem } from "../domain/contracts.js";
import type { TaskBoard } from "./task-board.js";

interface JiraTaskBoardOptions {
  baseUrl: string;
  email: string;
  apiToken: string;
  spaceKey?: string;
  blockedLabel?: string;
  inProgressStatus?: string;
  blockedStatus?: string;
  inReviewStatus?: string;
  doneStatus?: string;
  fetch?: typeof fetch;
}

interface JiraIssueResponse {
  key?: unknown;
  fields?: {
    summary?: unknown;
    description?: unknown;
    labels?: unknown;
    status?: { name?: unknown };
    comment?: { comments?: unknown };
  };
}

interface JiraComment {
  id?: unknown;
  body?: unknown;
}

interface JiraIssueState {
  labels: string[];
  status: string;
  latestQuestionSignature?: string;
  hasReplyAfterQuestion: boolean;
}

interface AtlassianDocumentNode {
  type?: unknown;
  text?: unknown;
  content?: unknown;
}

export class JiraTaskBoard implements TaskBoard {
  private readonly baseUrl: string;
  private apiBaseUrl: string;
  private readonly request: typeof fetch;
  private readonly issueStates = new Map<string, JiraIssueState>();

  constructor(private readonly options: JiraTaskBoardOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.apiBaseUrl = this.baseUrl;
    this.request = options.fetch ?? fetch;
  }

  async checkConnection(): Promise<void> {
    const response = await this.requestJira("/rest/api/3/myself");
    if (!response.ok) {
      throw new Error(
        `Jira authentication check returned HTTP ${response.status}. ` +
          "Check JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN.",
      );
    }
  }

  async getAvailableTransitions(id: string): Promise<string[]> {
    assertWorkItemId(id);
    const response = await this.requestJira(`/rest/api/3/issue/${encodeURIComponent(id)}/transitions`);
    if (!response.ok) {
      throw new Error(`Jira returned HTTP ${response.status} while listing transitions for ${id}`);
    }
    return jiraTransitions(await response.json()).map((transition) =>
      transition.toName || transition.name
    );
  }

  async getTask(id: string): Promise<WorkItem> {
    assertWorkItemId(id);
    if (this.options.spaceKey && !id.startsWith(`${this.options.spaceKey}-`)) {
      throw new Error(`Work item ${id} does not belong to Jira space ${this.options.spaceKey}`);
    }

    const path = `/rest/api/3/issue/${encodeURIComponent(id)}?fields=summary,description,labels,status,comment`;
    const response = await this.requestJira(path);

    if (!response.ok) {
      const hint = response.status === 401 || response.status === 403
        ? " Check the Jira email, API token, and issue permissions."
        : "";
      throw new Error(`Jira returned HTTP ${response.status} for ${id}.${hint}`);
    }

    const issue: unknown = await response.json();
    const mapped = mapJiraIssue(issue, id);
    const state = jiraIssueState(issue);
    this.issueStates.set(mapped.id, state);
    const clarifications = jiraClarifications(issue);
    if (clarifications.length === 0) {
      return mapped;
    }
    return {
      ...mapped,
      technicalContext: [
        ...(mapped.technicalContext ?? []),
        ...clarifications.map((text) => `Jira clarification: ${text}`),
      ],
    };
  }

  async markInProgress(item: WorkItem): Promise<void> {
    await this.removeBlockedLabel(item);
    await this.transitionTo(item.id, configuredNames(this.options.inProgressStatus, ["Em andamento", "In Progress"]));
  }

  async markWaitingForInput(item: WorkItem, questions: string[]): Promise<void> {
    const signature = questionSignature(questions);
    const state = this.issueStates.get(item.id);
    if (state?.latestQuestionSignature !== signature || state.hasReplyAfterQuestion) {
      await this.addComment(item.id, [
        `[AgentForge:questions:${signature}]`,
        "O AgentForge precisa das seguintes informações antes de continuar:",
        ...questions.map((question, index) => `${index + 1}. ${question}`),
        "Responda neste card e execute novamente o comando do AgentForge.",
      ]);
      if (state) {
        state.latestQuestionSignature = signature;
        state.hasReplyAfterQuestion = false;
      }
    }
    await this.addBlockedLabel(item);
    await this.transitionTo(item.id, configuredNames(this.options.blockedStatus, ["Bloqueado", "Blocked"]));
  }

  async markReadyForMerge(item: WorkItem, publication: PullRequestPublication): Promise<void> {
    await this.removeBlockedLabel(item);
    await this.addComment(item.id, [
      "[AgentForge:ready-for-merge]",
      "A implementação, os testes e a revisão automática foram concluídos.",
      `Pull Request: ${publication.url}`,
      "A única ação humana restante é realizar o merge.",
    ]);
    await this.transitionTo(item.id, configuredNames(this.options.inReviewStatus, [
      "Em revisão",
      "In Review",
      "Code Review",
    ]));
  }

  async markDone(item: WorkItem, publication: PullRequestPublication): Promise<void> {
    await this.addComment(item.id, [
      "[AgentForge:completed]",
      `O merge da Pull Request #${publication.number} foi confirmado pelo GitHub.`,
      "A tarefa foi concluída automaticamente pelo AgentForge.",
    ]);
    await this.transitionTo(item.id, configuredNames(this.options.doneStatus, [
      "Concluído",
      "Concluida",
      "Concluída",
      "Done",
    ]));
  }

  private headers(): Record<string, string> {
    return {
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${this.options.email}:${this.options.apiToken}`).toString("base64")}`,
    };
  }

  private async requestJira(path: string, method = "GET", body?: unknown): Promise<Response> {
    const requestInit = (): RequestInit => ({
      method,
      headers: {
        ...this.headers(),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    let response = await this.request(`${this.apiBaseUrl}${path}`, {
      ...requestInit(),
    });
    if (response.status !== 401 || this.apiBaseUrl !== this.baseUrl) {
      return response;
    }

    const scopedBaseUrl = await this.discoverScopedApiBaseUrl();
    if (!scopedBaseUrl) {
      return response;
    }
    response = await this.request(`${scopedBaseUrl}${path}`, {
      ...requestInit(),
    });
    if (response.ok) {
      this.apiBaseUrl = scopedBaseUrl;
    }
    return response;
  }

  private async addComment(id: string, lines: string[]): Promise<void> {
    const response = await this.requestJira(
      `/rest/api/3/issue/${encodeURIComponent(id)}/comment`,
      "POST",
      { body: adfDocument(lines) },
    );
    assertJiraWrite(response, `add a comment to ${id}`);
  }

  private async addBlockedLabel(item: WorkItem): Promise<void> {
    const label = this.options.blockedLabel ?? "agentforge-needs-input";
    const state = this.issueStates.get(item.id);
    if (item.labels.includes(label) || state?.labels.includes(label)) return;
    const response = await this.requestJira(
      `/rest/api/3/issue/${encodeURIComponent(item.id)}`,
      "PUT",
      { update: { labels: [{ add: label }] } },
    );
    assertJiraWrite(response, `add label ${label} to ${item.id}`);
    state?.labels.push(label);
  }

  private async removeBlockedLabel(item: WorkItem): Promise<void> {
    const label = this.options.blockedLabel ?? "agentforge-needs-input";
    const state = this.issueStates.get(item.id);
    if (!item.labels.includes(label) && !state?.labels.includes(label)) return;
    const response = await this.requestJira(
      `/rest/api/3/issue/${encodeURIComponent(item.id)}`,
      "PUT",
      { update: { labels: [{ remove: label }] } },
    );
    assertJiraWrite(response, `remove label ${label} from ${item.id}`);
    if (state) state.labels = state.labels.filter((value) => value !== label);
  }

  private async transitionTo(id: string, desiredNames: string[]): Promise<void> {
    const state = this.issueStates.get(id);
    if (desiredNames.some((name) => normalizeName(name) === normalizeName(state?.status ?? ""))) return;
    const response = await this.requestJira(`/rest/api/3/issue/${encodeURIComponent(id)}/transitions`);
    if (!response.ok) {
      throw new Error(`Jira returned HTTP ${response.status} while listing transitions for ${id}`);
    }
    const value: unknown = await response.json();
    const transitions = jiraTransitions(value);
    const selected = transitions.find((transition) => {
      const candidates = [transition.name, transition.toName].map(normalizeName);
      return desiredNames.some((desired) => candidates.includes(normalizeName(desired)));
    });
    if (!selected) {
      return;
    }
    const transitionResponse = await this.requestJira(
      `/rest/api/3/issue/${encodeURIComponent(id)}/transitions`,
      "POST",
      { transition: { id: selected.id } },
    );
    assertJiraWrite(transitionResponse, `transition ${id} to ${selected.toName || selected.name}`);
    if (state) state.status = selected.toName || selected.name;
  }

  private async discoverScopedApiBaseUrl(): Promise<string | undefined> {
    const response = await this.request(`${this.baseUrl}/_edge/tenant_info`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return undefined;
    }
    const value: unknown = await response.json();
    if (!value || typeof value !== "object") {
      return undefined;
    }
    const cloudId = (value as { cloudId?: unknown }).cloudId;
    return typeof cloudId === "string" && cloudId.length > 0
      ? `https://api.atlassian.com/ex/jira/${cloudId}`
      : undefined;
  }
}

function assertWorkItemId(id: string): void {
  if (!/^[A-Z][A-Z0-9_]*-\d+$/.test(id)) {
    throw new Error(`Invalid work item id: ${id}`);
  }
}

function mapJiraIssue(value: unknown, requestedId: string): WorkItem {
  if (!value || typeof value !== "object") {
    throw new Error("Jira issue response must be an object");
  }

  const issue = value as JiraIssueResponse;
  const key = typeof issue.key === "string" ? issue.key : requestedId;
  const summary = issue.fields?.summary;
  if (typeof summary !== "string" || summary.trim().length === 0) {
    throw new Error(`Jira issue ${requestedId} has no summary`);
  }

  const description = adfToText(issue.fields?.description).trim();
  const technicalContext = extractSection(issue.fields?.description, description, [
    "technical context",
    "contexto técnico",
    "contexto tecnico",
  ]);
  const outOfScope = extractSection(issue.fields?.description, description, [
    "out of scope",
    "fora do escopo",
  ]);
  const labels = Array.isArray(issue.fields?.labels)
    ? issue.fields.labels.filter((label): label is string => typeof label === "string")
    : [];

  return {
    id: key,
    title: summary,
    description,
    acceptanceCriteria: extractAcceptanceCriteria(issue.fields?.description, description),
    labels,
    source: "jira",
    ...(technicalContext.length > 0 ? { technicalContext } : {}),
    ...(outOfScope.length > 0 ? { outOfScope } : {}),
  };
}

function adfToText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (!value || typeof value !== "object") {
    return "";
  }

  const node = value as AtlassianDocumentNode;
  const ownText = typeof node.text === "string" ? node.text : "";
  const children = Array.isArray(node.content) ? node.content.map(adfToText) : [];
  const separator = node.type === "paragraph" || node.type === "listItem" || node.type === "heading"
    ? "\n"
    : "";
  return `${ownText}${children.join("")}${separator}`;
}

function extractAcceptanceCriteria(adf: unknown, description: string): AcceptanceCriterion[] {
  const structured = extractAcceptanceCriteriaFromAdf(adf);
  if (structured.length > 0) {
    return structured;
  }

  const lines = description
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const headingIndex = lines.findIndex((line) =>
    /^(acceptance criteria|crit[eé]rios? de aceite)\s*:??$/i.test(line),
  );
  if (headingIndex < 0) {
    return [];
  }

  const criteria: AcceptanceCriterion[] = [];
  for (const line of lines.slice(headingIndex + 1)) {
    if (/^[\p{L}][\p{L}\s-]+:?$/u.test(line) && criteria.length > 0) {
      break;
    }
    const text = line.replace(/^(?:[-*•]|\d+[.)]|AC-?\d+\s*[:.)-])\s*/i, "").trim();
    if (text) {
      criteria.push({ id: `AC-${criteria.length + 1}`, text });
    }
  }
  return criteria;
}

function extractAcceptanceCriteriaFromAdf(value: unknown): AcceptanceCriterion[] {
  if (!value || typeof value !== "object") {
    return [];
  }
  const root = value as AtlassianDocumentNode;
  if (!Array.isArray(root.content)) {
    return [];
  }

  const headingIndex = root.content.findIndex((child) => {
    if (!child || typeof child !== "object") {
      return false;
    }
    const node = child as AtlassianDocumentNode;
    return node.type === "heading" &&
      /^(acceptance criteria|crit[eé]rios? de aceite)\s*:??$/i.test(nodeText(node).trim());
  });
  if (headingIndex < 0) {
    return [];
  }

  const texts: string[] = [];
  for (const child of root.content.slice(headingIndex + 1)) {
    if (!child || typeof child !== "object") {
      continue;
    }
    const node = child as AtlassianDocumentNode;
    if (node.type === "heading") {
      break;
    }
    if (node.type === "bulletList" || node.type === "orderedList") {
      for (const listItem of Array.isArray(node.content) ? node.content : []) {
        const text = nodeText(listItem).trim();
        if (text) texts.push(text);
      }
      continue;
    }
    const text = nodeText(node).trim();
    if (text) texts.push(text);
  }

  return texts.map((text, index) => ({
    id: `AC-${index + 1}`,
    text: text.replace(/^(?:[-*•]|\d+[.)]|AC-?\d+\s*[:.)-])\s*/i, "").trim(),
  }));
}

function extractSection(value: unknown, description: string, headings: string[]): string[] {
  const structured = extractSectionFromAdf(value, headings);
  return structured.length > 0 ? structured : extractSectionFromText(description, headings);
}

function extractSectionFromAdf(value: unknown, headings: string[]): string[] {
  if (!value || typeof value !== "object") {
    return [];
  }
  const root = value as AtlassianDocumentNode;
  if (!Array.isArray(root.content)) {
    return [];
  }
  const normalizedHeadings = new Set(headings.map((heading) => heading.toLocaleLowerCase("pt-BR")));
  const headingIndex = root.content.findIndex((child) => {
    if (!child || typeof child !== "object") {
      return false;
    }
    const node = child as AtlassianDocumentNode;
    const heading = nodeText(node).trim().replace(/:$/, "").toLocaleLowerCase("pt-BR");
    return node.type === "heading" && normalizedHeadings.has(heading);
  });
  if (headingIndex < 0) {
    return [];
  }

  const entries: string[] = [];
  for (const child of root.content.slice(headingIndex + 1)) {
    if (!child || typeof child !== "object") {
      continue;
    }
    const node = child as AtlassianDocumentNode;
    if (node.type === "heading") {
      break;
    }
    if (node.type === "bulletList" || node.type === "orderedList") {
      for (const listItem of Array.isArray(node.content) ? node.content : []) {
        const text = nodeText(listItem).trim();
        if (text) entries.push(text);
      }
      continue;
    }
    const text = nodeText(node).trim();
    if (text) entries.push(text);
  }
  return entries;
}

function extractSectionFromText(description: string, headings: string[]): string[] {
  const lines = description.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const normalizedHeadings = new Set(headings.map(normalizeHeading));
  const headingIndex = lines.findIndex((line) => normalizedHeadings.has(normalizeHeading(line)));
  if (headingIndex < 0) {
    return [];
  }

  const knownSectionHeadings = new Set([
    "acceptance criteria",
    "criterio de aceite",
    "criterios de aceite",
    "technical context",
    "contexto tecnico",
    "out of scope",
    "fora do escopo",
  ]);
  const entries: string[] = [];
  for (const line of lines.slice(headingIndex + 1)) {
    if (knownSectionHeadings.has(normalizeHeading(line))) {
      break;
    }
    const text = line.replace(/^(?:[-*•]|\d+[.)])\s*/, "").trim();
    if (text) entries.push(text);
  }
  return entries;
}

function normalizeHeading(value: string): string {
  return value
    .replace(/:$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function nodeText(value: unknown): string {
  if (!value || typeof value !== "object") {
    return "";
  }
  const node = value as AtlassianDocumentNode;
  const ownText = typeof node.text === "string" ? node.text : "";
  const children = Array.isArray(node.content) ? node.content.map(nodeText).join("") : "";
  return ownText + children;
}

function jiraIssueState(value: unknown): JiraIssueState {
  const issue = value && typeof value === "object" ? value as JiraIssueResponse : {};
  const labels = Array.isArray(issue.fields?.labels)
    ? issue.fields.labels.filter((label): label is string => typeof label === "string")
    : [];
  const comments = jiraComments(issue);
  let latestQuestionIndex = -1;
  let latestQuestionSignature: string | undefined;
  comments.forEach((comment, index) => {
    const marker = commentText(comment).match(/\[AgentForge:questions:([a-f0-9]+)]/i);
    if (marker?.[1]) {
      latestQuestionIndex = index;
      latestQuestionSignature = marker[1];
    }
  });
  return {
    labels,
    status: typeof issue.fields?.status?.name === "string" ? issue.fields.status.name : "",
    ...(latestQuestionSignature ? { latestQuestionSignature } : {}),
    hasReplyAfterQuestion: latestQuestionIndex >= 0 && comments
      .slice(latestQuestionIndex + 1)
      .some((comment) => !commentText(comment).includes("[AgentForge:")),
  };
}

function jiraClarifications(value: unknown): string[] {
  const issue = value && typeof value === "object" ? value as JiraIssueResponse : {};
  const comments = jiraComments(issue);
  let latestQuestionIndex = -1;
  comments.forEach((comment, index) => {
    if (/\[AgentForge:questions:[a-f0-9]+]/i.test(commentText(comment))) {
      latestQuestionIndex = index;
    }
  });
  if (latestQuestionIndex < 0) return [];
  return comments
    .slice(latestQuestionIndex + 1)
    .map(commentText)
    .filter((text) => text.length > 0 && !text.includes("[AgentForge:"));
}

function jiraComments(issue: JiraIssueResponse): JiraComment[] {
  const comments = issue.fields?.comment?.comments;
  return Array.isArray(comments)
    ? comments.filter((comment): comment is JiraComment => Boolean(comment && typeof comment === "object"))
    : [];
}

function commentText(comment: JiraComment): string {
  return adfToText(comment.body).trim();
}

function questionSignature(questions: string[]): string {
  return createHash("sha256").update(questions.join("\n")).digest("hex").slice(0, 12);
}

function adfDocument(lines: string[]) {
  return {
    type: "doc",
    version: 1,
    content: lines.map((line) => ({
      type: "paragraph",
      content: [{ type: "text", text: line }],
    })),
  };
}

function configuredNames(configured: string | undefined, defaults: string[]): string[] {
  return [...(configured ? [configured] : []), ...defaults];
}

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function jiraTransitions(value: unknown): Array<{ id: string; name: string; toName: string }> {
  if (!value || typeof value !== "object") return [];
  const transitions = (value as { transitions?: unknown }).transitions;
  if (!Array.isArray(transitions)) return [];
  return transitions.flatMap((transition) => {
    if (!transition || typeof transition !== "object") return [];
    const candidate = transition as { id?: unknown; name?: unknown; to?: { name?: unknown } };
    if (typeof candidate.id !== "string" || typeof candidate.name !== "string") return [];
    return [{
      id: candidate.id,
      name: candidate.name,
      toName: typeof candidate.to?.name === "string" ? candidate.to.name : "",
    }];
  });
}

function assertJiraWrite(response: Response, action: string): void {
  if (!response.ok) {
    throw new Error(`Jira returned HTTP ${response.status} while attempting to ${action}`);
  }
}
