# AgentForge

AgentForge is a small, auditable reference project for the course **Engenharia de Agentes de IA: do Jira ao Pull Request**.

It demonstrates a supervised delivery flow:

```text
WorkItem -> analysis -> implementation -> tests -> review -> evidence
         -> READY_FOR_HUMAN -> simulated pull request
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

The default demo does not make an API request. To use the optional OpenAI analyst with the Jira
source configured later in this guide:

```bash
export ANALYSIS_PROVIDER=openai
export OPENAI_API_KEY="your-key"
export OPENAI_MODEL="gpt-5-mini"
npm run demo:jira
```

`npm run demo` always forces the local task and analyst, even when `.env` contains real Jira or
OpenAI credentials. This keeps the first lesson offline and reproducible.

Never commit `.env` or place a real key in course files or recordings.

### Read a real Jira work item

The Jira adapter performs a read-only `GET` request to Jira Cloud. Copy `.env.example` to
`.env` and fill in `JIRA_BASE_URL`, `JIRA_EMAIL`,
`JIRA_API_TOKEN`, `JIRA_SPACE_KEY`, and `JIRA_ISSUE_KEY`. Then run:

```bash
npm run jira:check
npm run demo:jira
```

The Jira description must include a heading named `Acceptance criteria` or
`Critérios de aceite`, followed by one criterion per line or list item. Credentials are
never written to evidence artifacts.

When all three Jira connection values are present, Jira is selected automatically. Set
`TASK_SOURCE=local` explicitly whenever you want the deterministic offline fixture instead.

### Publish an approved Pull Request to GitHub

Create a fine-grained GitHub token restricted to the target repository with `Contents: write`
and `Pull requests: write`. Fill in the `GITHUB_*` values in `.env`, then verify access without
writing anything:

```bash
npm run github:check
```

The normal demo remains simulated. After inspecting its workspace diff and evidence, publication
requires a different command with an explicit external-write flag:

```bash
npm run github:publish -- --approve-external --run=<reviewed-run-id>
```

The publisher creates one commit on a new `agentforge/<work-item>-<timestamp>` branch and opens a
Pull Request against `main`. It can only publish `src/task.js` and `test/task.test.js`, mapped under
`examples/taskboard-template/`. The run identifier binds approval to the exact evidence and diff
already reviewed, so publication never reruns the model. It never merges the Pull Request.

If `node --version` reports a release older than 22, switch to a supported runtime before recording or testing the OpenAI provider.

The demo copies the immutable `examples/taskboard-baseline` into an isolated run directory under
`.agentforge/runs`, initializes a temporary Git repository, applies the task, runs its tests,
reviews the diff, and writes an evidence bundle plus a simulated pull request. Real GitHub
publication maps approved files into `examples/taskboard-template`, which may evolve after merges
without making future recordings non-reproducible.

## Safety properties

- tools resolve paths inside an explicitly authorized workspace;
- writes require an approval token;
- shell commands come from a fixed allowlist;
- external writes are simulated by default;
- facts, hypotheses, tests, and pending validation are represented separately;
- the final state requires human approval.

## Analysis providers

- `local`: deterministic, free, and used by the automated tests.
- `openai`: uses `@openai/agents` with a Zod `outputType` for `ImplementationBrief`.

Both providers implement the same application interface. The orchestrator does not know which provider produced the brief.

## Course checkpoints

Tags will be created only after the complete local flow is stable. Each checkpoint must install cleanly and pass its own tests before recording.
