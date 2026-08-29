import type { WorkItem } from "../domain/contracts.js";

export interface TaskBoard {
  getTask(id: string): Promise<WorkItem>;
}
