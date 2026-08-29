import type { AcceptanceCriterion, WorkItem } from "../domain/contracts.js";
import type { TaskBoard } from "./task-board.js";

interface JiraTaskBoardOptions {
  baseUrl: string;
  email: string;
  apiToken: string;
  spaceKey?: string;
  fetch?: typeof fetch;
}

interface JiraIssueResponse {
  key?: unknown;
  fields?: {
    summary?: unknown;
    description?: unknown;
    labels?: unknown;
  };
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

  async getTask(id: string): Promise<WorkItem> {
    assertWorkItemId(id);
    if (this.options.spaceKey && !id.startsWith(`${this.options.spaceKey}-`)) {
      throw new Error(`Work item ${id} does not belong to Jira space ${this.options.spaceKey}`);
    }

    const path = `/rest/api/3/issue/${encodeURIComponent(id)}?fields=summary,description,labels`;
    const response = await this.requestJira(path);

    if (!response.ok) {
      const hint = response.status === 401 || response.status === 403
        ? " Check the Jira email, API token, and issue permissions."
        : "";
      throw new Error(`Jira returned HTTP ${response.status} for ${id}.${hint}`);
    }

    const issue: unknown = await response.json();
    return mapJiraIssue(issue, id);
  }

  private headers(): Record<string, string> {
    return {
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${this.options.email}:${this.options.apiToken}`).toString("base64")}`,
    };
  }

  private async requestJira(path: string): Promise<Response> {
    let response = await this.request(`${this.apiBaseUrl}${path}`, {
      method: "GET",
      headers: this.headers(),
    });
    if (response.status !== 401 || this.apiBaseUrl !== this.baseUrl) {
      return response;
    }

    const scopedBaseUrl = await this.discoverScopedApiBaseUrl();
    if (!scopedBaseUrl) {
      return response;
    }
    response = await this.request(`${scopedBaseUrl}${path}`, {
      method: "GET",
      headers: this.headers(),
    });
    if (response.ok) {
      this.apiBaseUrl = scopedBaseUrl;
    }
    return response;
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
