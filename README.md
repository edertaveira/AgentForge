# AgentForge

AgentForge is a small, auditable reference project for the course **Engenharia de Agentes de IA: do Jira ao Pull Request**.

It demonstrates an autonomous delivery flow with one deliberate human boundary:

```text
WorkItem -> analysis -> implementation -> tests -> review -> evidence
         -> READY_TO_PUBLISH -> branch + commit + Pull Request
         -> READY_FOR_MERGE -> human merge
```

The first version runs with local fixtures and a deterministic analysis provider by default. An optional OpenAI Agents SDK provider adds real model analysis with schema-validated output. Jira, GitHub, and MCP remain adapters rather than prerequisites for understanding the domain.

## Requirements

- Node.js 22 or newer
- npm
- Git

## Run

```bash
npm install
npm test
npm run demo
```

## Install and initialize the CLI

Build and link the development version once:

```bash
npm run build
npm link
```

Then enter the repository, or a project directory inside a monorepo, and initialize AgentForge:

```bash
cd /path/to/project
agentforge init
```

The CLI detects the Git root, `origin`, base branch, and the project's real path inside the
repository. It stores non-secret metadata in `.agentforge/config.json`; credentials remain in the
environment or the nearest `.env` file. No manually configured GitHub destination prefix is used.

Use the CLI with the default Jira work item or an explicit key:

```bash
agentforge check
agentforge run
agentforge run AF-2
```

The integrated run refuses to start while the target project has uncommitted changes. This ensures
that its isolated workspace and Pull Request start from a known repository state.

The default demo does not make an API request. To use the optional OpenAI analyst with the Jira
source configured later in this guide:

```bash
export ANALYSIS_PROVIDER=openai
export OPENAI_API_KEY="your-key"
export OPENAI_MODEL="gpt-5-mini"
agentforge run
```

`npm run demo` always forces the local task and analyst, even when `.env` contains real Jira or
OpenAI credentials. This keeps the first lesson offline and reproducible.

Never commit `.env` or place a real key in course files or recordings.

### Use Jira as the autonomous workflow board

Copy `.env.example` to `.env` and fill in the Jira connection, status names, and issue key. Then run:

```bash
agentforge check
agentforge run
```

The Jira description must include a heading named `Acceptance criteria` or
`Critérios de aceite`, followed by one criterion per line or list item. Credentials are
never written to evidence artifacts.

When all three Jira connection values are present, Jira is selected automatically. Set
`TASK_SOURCE=local` explicitly whenever you want the deterministic offline fixture instead.

The Jira adapter moves an accepted task to In Progress. If analysis finds a material ambiguity,
it posts the questions as a comment, applies the `agentforge-needs-input` label, and moves the card
to Blocked when that transition exists. Reply on the issue and run `agentforge run` again: the
reply becomes analysis context, the flag is removed, and the delivery resumes. After the Pull
Request is created, the card moves to In Review and receives the PR URL.

### Publish a Pull Request automatically

Create a fine-grained GitHub token restricted to the target repository with `Contents: write`
and `Pull requests: write`. Fill in the `GITHUB_*` values in `.env`, then verify access without
writing anything:

```bash
agentforge check
```

`agentforge run` runs the complete delivery automatically. After analysis, isolated
implementation, tests, and review pass, the publisher creates one commit on a new
`agentforge/<work-item>-<timestamp>` branch and opens a Pull Request against `main`. It can only
publish `src/task.js` and `test/task.test.js`, mapped to the real demonstration application in
`examples/taskboard/`.

There is intentionally no merge operation in AgentForge. The final status is `READY_FOR_MERGE`,
and merging the Pull Request is the only human action left in the delivery flow. The running
command polls the PR; after the human merge, it comments on Jira, moves the card to Done, and records
`COMPLETED` in the evidence.

The destination is intentionally fixed: the agent changes the real demonstration application on a
new Git branch, exactly as it would change an ordinary project. To repeat the same lesson after its
Pull Request has been merged, restore the course checkpoint or use a new ticket that requests a
different change; do not create disposable destination folders.

### Inspect context through local MCP

The local MCP server uses the `stdio` transport and exposes three read-only tools:

- `get_work_item`: reads the configured local or Jira item;
- `get_repository_context`: reads only the immutable TaskBoard baseline allowlist;
- `get_run_evidence`: reads a bounded summary of one reviewed run.

Run the recording demonstration with:

```bash
npm run mcp:demo
```

The demo agent is filtered to the first two tools. The server exposes no write, shell, GitHub, or
credential-reading tool, and closes in a `finally` block after the agent run.

If `node --version` reports a release older than 22, switch to a supported runtime before recording or testing the OpenAI provider.

The demo copies the immutable `examples/taskboard-baseline` into an isolated run directory under
`.agentforge/runs`, initializes a temporary Git repository, applies the task, runs its tests,
reviews the diff, and writes an evidence bundle plus a Pull Request description. In Jira mode,
successful evidence is published automatically to GitHub and recorded in `publication.json`.
Local mode remains offline and reproducible.

## Safety properties

- tools resolve paths inside an explicitly authorized workspace;
- writes require an approval token;
- shell commands come from a fixed allowlist;
- GitHub publication happens only after tests and automated review pass;
- facts, hypotheses, tests, and pending validation are represented separately;
- the publisher exposes no merge operation;
- the final state leaves only the Pull Request merge to a human.

## Analysis providers

- `local`: deterministic, free, and used by the automated tests.
- `openai`: uses `@openai/agents` with a Zod `outputType` for `ImplementationBrief`.

Both providers implement the same application interface. The orchestrator does not know which provider produced the brief.

## Course checkpoints

Tags will be created only after the complete local flow is stable. Each checkpoint must install cleanly and pass its own tests before recording.
