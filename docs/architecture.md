# Architecture

## Delivery flow

```text
TaskBoard (local fixture or Jira Cloud)
     |
     v
 AnalystAgent -> ImplementationBrief
     | ambiguity
     +----> Jira comment + needs-input flag + Blocked
                 |
                 +---- human Jira reply, then rerun
     |
     v
 Scoped workspace authorization
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
 EvidenceBundle -> READY_TO_PUBLISH -> GitHubPublisher
     |
     v
 branch + commit + Pull Request -> Jira In Review -> READY_FOR_MERGE
     |
     v
 human merge -> GitHub confirmation -> Jira Done -> COMPLETED
```

## Boundaries

- `CLI`: runs from the target project directory, detects the Git root, remote, base branch, and
  monorepo-relative target path, then stores non-secret metadata under `.agentforge/config.json`.
- `domain`: stable contracts independent of Jira, GitHub, or a model vendor.
- `adapters`: local task source and isolated filesystem implementation.
- `JiraTaskBoard` reads the issue and its comments, posts blocking questions and PR evidence,
  manages the `agentforge-needs-input` label, and uses available workflow transitions.
- `agents`: one responsibility per role, with typed inputs and outputs.
- `core`: authorization, path policy, and pull request preparation.
- `orchestrator`: state transitions and evidence assembly.
- `GitHubPublisher`: creates a tree, commit, branch, and Pull Request automatically, but only with
  `READY_TO_PUBLISH` evidence, passing tests, an approved automated review, and an allowlisted diff.
  It contains no merge endpoint.
- `examples/taskboard-baseline`: immutable fixture copied into the isolated execution workspace.
- `examples/taskboard`: real demonstration application changed by the generated Git branch and
  Pull Request. The branch provides isolation; no disposable target directory is created.
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
- Jira runs publish the Pull Request automatically. Merge remains a separate human action.
- MCP remains a later adapter.

These constraints are features of the teaching baseline, not claims of production completeness.
