import type { ImplementationBrief, WorkItem } from "../domain/contracts.js";

export interface AnalysisAgent {
  analyze(item: WorkItem): Promise<ImplementationBrief>;
}
