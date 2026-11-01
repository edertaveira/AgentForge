import { JiraTaskBoard } from "../adapters/jira-task-board.js";
import { LocalTaskBoard } from "../adapters/local-task-board.js";
import type { TaskBoard } from "../adapters/task-board.js";

export type TaskSourceName = "local" | "jira";

export interface TaskSourceConfig {
  source: TaskSourceName;
  jira?: {
    baseUrl: string;
    email: string;
    apiToken: string;
    spaceKey?: string;
    blockedLabel?: string;
    inProgressStatus?: string;
    blockedStatus?: string;
    inReviewStatus?: string;
    doneStatus?: string;
  };
}

export function taskSourceFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): TaskSourceConfig {
  const hasJiraCredentials = Boolean(
    environment.JIRA_BASE_URL && environment.JIRA_EMAIL && environment.JIRA_API_TOKEN,
  );
  const configuredSource = environment.TASK_SOURCE?.trim();
  const source = configuredSource || (hasJiraCredentials ? "jira" : "local");
  if (source !== "local" && source !== "jira") {
    throw new Error(`Unsupported TASK_SOURCE: ${source}`);
  }
  if (source === "local") {
    return { source };
  }

  const baseUrl = required(environment, "JIRA_BASE_URL");
  const email = required(environment, "JIRA_EMAIL");
  const apiToken = required(environment, "JIRA_API_TOKEN");
  return {
    source,
    jira: {
      baseUrl,
      email,
      apiToken,
      ...(environment.JIRA_SPACE_KEY ? { spaceKey: environment.JIRA_SPACE_KEY } : {}),
      ...(environment.JIRA_BLOCKED_LABEL ? { blockedLabel: environment.JIRA_BLOCKED_LABEL } : {}),
      ...(environment.JIRA_STATUS_IN_PROGRESS ? { inProgressStatus: environment.JIRA_STATUS_IN_PROGRESS } : {}),
      ...(environment.JIRA_STATUS_BLOCKED ? { blockedStatus: environment.JIRA_STATUS_BLOCKED } : {}),
      ...(environment.JIRA_STATUS_IN_REVIEW ? { inReviewStatus: environment.JIRA_STATUS_IN_REVIEW } : {}),
      ...(environment.JIRA_STATUS_DONE ? { doneStatus: environment.JIRA_STATUS_DONE } : {}),
    },
  };
}

export function createTaskBoard(config: TaskSourceConfig, fixturesDirectory: string): TaskBoard {
  if (config.source === "local") {
    return new LocalTaskBoard(fixturesDirectory);
  }
  if (!config.jira) {
    throw new Error("Jira configuration is required when TASK_SOURCE=jira");
  }
  return new JiraTaskBoard(config.jira);
}

function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required when TASK_SOURCE=jira`);
  }
  return value;
}
