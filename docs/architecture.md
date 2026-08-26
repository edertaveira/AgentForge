# Architecture

## Delivery flow

```text
LocalTaskBoard
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
- `agents`: one responsibility per role, with typed inputs and outputs.
- `core`: authorization, path policy, and pull request preparation.
- `orchestrator`: state transitions and evidence assembly.

## Deliberate constraints in version 0.1

- The implementation recipe supports one local fixture task (`AF-101`).
- The model behavior is deterministic so the first demonstration is reproducible.
- Only `node --test` is allowed as an execution tool.
- Pull Request publication is simulated and always requires a separate human action.
- Jira, MCP, GitHub, and remote model integrations are later adapters.

These constraints are features of the teaching baseline, not claims of production completeness.
