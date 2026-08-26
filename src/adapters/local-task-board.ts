import { readFile } from "node:fs/promises";
import path from "node:path";
import type { WorkItem } from "../domain/contracts.js";

export class LocalTaskBoard {
  constructor(private readonly fixturesDirectory: string) {}

  async getTask(id: string): Promise<WorkItem> {
    if (!/^[A-Z]+-\d+$/.test(id)) {
      throw new Error(`Invalid work item id: ${id}`);
    }

    const file = path.join(this.fixturesDirectory, `${id}.json`);
    const content = await readFile(file, "utf8");
    const parsed: unknown = JSON.parse(content);
    assertWorkItem(parsed);
    return parsed;
  }
}

function assertWorkItem(value: unknown): asserts value is WorkItem {
  if (!value || typeof value !== "object") {
    throw new Error("Work item must be an object");
  }

  const item = value as Partial<WorkItem>;
  if (
    typeof item.id !== "string" ||
    typeof item.title !== "string" ||
    typeof item.description !== "string" ||
    !Array.isArray(item.acceptanceCriteria) ||
    !Array.isArray(item.labels) ||
    item.source !== "local"
  ) {
    throw new Error("Invalid work item fixture");
  }
}
