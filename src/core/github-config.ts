export interface GitHubConfig {
  token: string;
  owner: string;
  repository: string;
  baseBranch: string;
  targetDirectory: string;
}

export function githubConfigFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
  project?: { repository: string; baseBranch: string; targetDirectory: string },
): GitHubConfig {
  const inferred = project ? githubRepositoryCoordinates(project.repository) : undefined;
  return {
    token: required(environment, "GITHUB_TOKEN"),
    owner: environment.GITHUB_OWNER?.trim() || inferred?.owner || required(environment, "GITHUB_OWNER"),
    repository: environment.GITHUB_REPO?.trim() || inferred?.repository || required(environment, "GITHUB_REPO"),
    baseBranch: environment.GITHUB_BASE_BRANCH?.trim() || project?.baseBranch || "main",
    targetDirectory: project?.targetDirectory ?? "",
  };
}

function githubRepositoryCoordinates(remote: string): { owner: string; repository: string } | undefined {
  const match = remote.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (!match?.[1] || !match[2]) return undefined;
  return { owner: match[1], repository: match[2] };
}

function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required for GitHub integration`);
  return value;
}
