import type { PullRequestPublication, WorkItem } from "../domain/contracts.js";

export interface TaskBoard {
  getTask(id: string): Promise<WorkItem>;
  markInProgress?(item: WorkItem): Promise<void>;
  markWaitingForInput?(item: WorkItem, questions: string[]): Promise<void>;
  markReadyForMerge?(item: WorkItem, publication: PullRequestPublication): Promise<void>;
  markDone?(item: WorkItem, publication: PullRequestPublication): Promise<void>;
}
