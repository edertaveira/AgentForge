# Recording demo

## Prepare

```bash
npm install
npm test
npm run clean
```

Do not display `.env`, API keys, browser sessions, or personal Git credentials.

Confirm the supported runtime before recording:

```bash
node --version
```

The project requires Node.js 22 or newer.

Use `ANALYSIS_PROVIDER=local` for the first deterministic recording. Record the OpenAI provider as a separate lesson after verifying the account, model access, cost, and output with a disposable key and fictitious task data.

## Record the final result first

Run:

```bash
npm run demo
```

Show, in this order:

1. `fixtures/tasks/AF-101.json`: requested task and acceptance criteria; explain that the run starts
   from the immutable `examples/taskboard-baseline`.
2. CLI output: status, tests, review, and the local-mode notice that GitHub publication was skipped.
3. `.agentforge/runs/<run>/workspace`: isolated copy, not the source template.
4. `artifacts/evidence.json`: facts, hypotheses, changed files, tests, review, and pending human actions.
5. `artifacts/pull-request.md`: only tests that were actually executed.
6. The Git diff inside the isolated workspace.

The fixture deliberately records implementation-shaping decisions such as the public function signature. The analyst should block when those decisions are absent instead of silently inventing an API contract.

## Explain the first real failure

During development, the Git status collector removed the leading space from ` M src/task.js`, turning it into `rc/task.js`. The feature tests passed, but the reviewer blocked the delivery because the evidence named the wrong file. This is a useful example of why a passing test alone does not prove that an agent's complete delivery is reliable.

## Claims that are safe to make

- The local fixture tests were executed and passed in the demonstrated run.
- The reviewer approved the evidence produced by that run.
- In Jira mode, publication occurs only after tests and automated review pass.
- The final `READY_FOR_MERGE` action still requires a human decision.

## Claims to avoid

- The architecture is production-ready.
- The flow can implement arbitrary tasks.
- More agents automatically improve quality.
- MCP or Jira makes the agent correct.

## GitHub publication checkpoint

1. Run `agentforge check`; emphasize that it validates Jira and GitHub without writing.
2. Run `agentforge run` once.
3. Show analysis, isolated implementation, tests, automated review, branch, commit, and Pull Request.
4. Open the returned URL and review the Pull Request while the command waits.
5. Merge manually, return to the terminal, and show GitHub confirmation, Jira Done, and `COMPLETED`.

Use a fine-grained token restricted to this repository. Never show `.env`, the token creation
screen, request headers, or terminal history containing credentials during recording.

## MCP local checkpoint

1. Explain MCP as a standard boundary for context and tools, not as an autonomous agent.
2. Show the three registered tools and their read-only annotations.
3. Run `npm run mcp:demo` and show that the model discovers the Jira item and baseline files.
4. Emphasize the static tool filter: the demo exposes only work item and repository context.
5. Stop the server and show that no workspace, Jira, or GitHub write occurred.
