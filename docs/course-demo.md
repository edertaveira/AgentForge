# Recording demo

## Prepare

```bash
npm install
npm test
npm run clean
```

Do not display `.env`, API keys, browser sessions, or personal Git credentials.

## Record the final result first

Run:

```bash
npm run demo
```

Show, in this order:

1. `fixtures/tasks/AF-101.json`: requested task and acceptance criteria.
2. CLI output: status, tests, review, and the warning that no Pull Request was published.
3. `.agentforge/runs/<run>/workspace`: isolated copy, not the source template.
4. `artifacts/evidence.json`: facts, hypotheses, changed files, tests, review, and pending human actions.
5. `artifacts/pull-request.md`: only tests that were actually executed.
6. The Git diff inside the isolated workspace.

## Explain the first real failure

During development, the Git status collector removed the leading space from ` M src/task.js`, turning it into `rc/task.js`. The feature tests passed, but the reviewer blocked the delivery because the evidence named the wrong file. This is a useful example of why a passing test alone does not prove that an agent's complete delivery is reliable.

## Claims that are safe to make

- The local fixture tests were executed and passed in the demonstrated run.
- The reviewer approved the evidence produced by that run.
- The Pull Request was prepared but not published.
- The final action still requires a human decision.

## Claims to avoid

- The architecture is production-ready.
- The flow can implement arbitrary tasks.
- More agents automatically improve quality.
- MCP or Jira makes the agent correct.
