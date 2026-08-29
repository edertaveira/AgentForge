# Architecture

## Delivery flow

```text
TaskBoard (local fixture or read-only Jira Cloud)
     |
     v
 AnalystAgent -> ImplementationBrief
     |
     v
 ApprovalGate -> ApprovalToken
     |
     v
 ImplementerAgent -> isolated Workspace -> ChangeSet
     |
     v
 TesterAgent -> TestResult[]
     |
     v
 ReviewerAgent -> ReviewReport
     |
     v
 EvidenceBundle -> READY_FOR_HUMAN -> PullRequestDraft
```

## Boundaries

- `domain`: stable contracts independent of Jira, GitHub, or a model vendor.
- `adapters`: local task source and isolated filesystem implementation.
- `JiraTaskBoard` reads summary, description, labels, and acceptance criteria through Jira Cloud REST API v3. It performs no Jira writes.
- `agents`: one responsibility per role, with typed inputs and outputs.
- `core`: authorization, path policy, and pull request preparation.
- `orchestrator`: state transitions and evidence assembly.
- `GitHubPublisher`: external-write adapter that creates a tree, commit, branch, and Pull Request
  only with repository-scoped approval and `READY_FOR_HUMAN` evidence.
- `examples/taskboard-baseline`: immutable recording input; generated PRs target the separate
  `examples/taskboard-template` so merged demonstrations do not mutate future demo inputs.
- `mcp`: local stdio boundary exposing bounded work-item, repository-context, and run-evidence
  reads. MCP provides tools and context to an agent; it is not itself an agent or an authorization
  mechanism.

## Analysis providers

The orchestrator depends on the `AnalysisAgent` interface:

- `LocalAnalystAgent` provides deterministic output for tests and recordings that must not consume API credits.
- `OpenAIAnalystAgent` uses the OpenAI Agents SDK and a Zod `outputType` to validate `ImplementationBrief` at runtime.

Selecting `ANALYSIS_PROVIDER=openai` requires `OPENAI_API_KEY`. Missing credentials fail before a run begins. The model name is configurable through `OPENAI_MODEL` so the course does not bind its architecture to one model generation.

The analyst follows explicit interpretation rules for ordinary JavaScript defaults and quoted
message literals. This prevents non-material edge questions from randomly blocking a recording,
while genuinely implementation-shaping ambiguity still produces `blockingQuestions`.

## Deliberate constraints in version 0.1

- The implementation recipe supports the task-priority teaching scenario. It is selected from
  labels or explicit task evidence and approved file scope, never from a hard-coded Jira number.
- The model behavior is deterministic so the first demonstration is reproducible.
- Only `node --test` is allowed as an execution tool.
- Pull Request publication is simulated and always requires a separate human action.
- MCP remains a later adapter.

These constraints are features of the teaching baseline, not claims of production completeness.
