# Course checkpoints

Create tags only after the full baseline remains green. Suggested progression:

| Tag | Teaching state |
| --- | --- |
| `course/01-project-base` | Node.js, TypeScript, scripts, and clean install |
| `course/02-contracts` | WorkItem and structured output contracts |
| `course/03-analysis` | Local task board and analyst |
| `course/04-tools` | Path policy and approval gate |
| `course/05-implementation` | Isolated workspace and implementer |
| `course/06-review` | Tester, reviewer, and evidence bundle |
| `course/07-orchestration` | Complete local state flow |
| `course/08-delivery` | Pull Request draft and final demo |

Each tag must satisfy:

```bash
npm ci
npm test
```

Do not create the historical tags by deleting code from the final version. Build or reconstruct each checkpoint deliberately so its explanation and tests remain coherent.
