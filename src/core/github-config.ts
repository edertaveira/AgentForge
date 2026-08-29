export interface GitHubConfig {
  token: string;
  owner: string;
  repository: string;
  baseBranch: string;
  targetPrefix: string;
}

export function githubConfigFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): GitHubConfig {
  return {
    token: required(environment, "GITHUB_TOKEN"),
    owner: required(environment, "GITHUB_OWNER"),
    repository: required(environment, "GITHUB_REPO"),
    baseBranch: environment.GITHUB_BASE_BRANCH?.trim() || "main",
    targetPrefix: environment.GITHUB_TARGET_PREFIX?.trim() || "examples/taskboard-template",
  };
}

function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required for GitHub integration`);
  return value;
}
