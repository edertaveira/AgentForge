# AgentForge

AgentForge is a small, auditable reference project for the course **Engenharia de Agentes de IA: do Jira ao Pull Request**.

It demonstrates a supervised delivery flow:

```text
WorkItem -> analysis -> implementation -> tests -> review -> evidence
         -> READY_FOR_HUMAN -> simulated pull request
```

The first version intentionally runs with local fixtures and a deterministic provider. This keeps the core reproducible, cheap, and safe to record. Jira, GitHub, MCP, and remote model providers are adapters, not prerequisites for understanding the domain.

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

The demo copies `examples/taskboard-template` into an isolated run directory under `.agentforge/runs`, initializes a temporary Git repository, applies the task, runs its tests, reviews the diff, and writes an evidence bundle plus a simulated pull request.

## Safety properties

- tools resolve paths inside an explicitly authorized workspace;
- writes require an approval token;
- shell commands come from a fixed allowlist;
- external writes are simulated by default;
- facts, hypotheses, tests, and pending validation are represented separately;
- the final state requires human approval.

## Course checkpoints

Tags will be created only after the complete local flow is stable. Each checkpoint must install cleanly and pass its own tests before recording.
