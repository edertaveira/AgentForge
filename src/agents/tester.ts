import type { TestResult } from "../domain/contracts.js";
import { Workspace } from "../adapters/workspace.js";

export class TesterAgent {
  test(workspace: Workspace): TestResult[] {
    return [workspace.runAllowed("node --test")];
  }
}
