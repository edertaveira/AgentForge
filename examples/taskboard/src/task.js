const ALLOWED_PRIORITIES = new Set(["low", "medium", "high"]);

export function createTask(title, priority = "medium") {
  if (typeof title !== "string" || title.trim() === "") {
    throw new Error("title is required");
  }

  if (!ALLOWED_PRIORITIES.has(priority)) {
    throw new Error(`invalid priority: ${priority}`);
  }

  return {
    title: title.trim(),
    status: "open",
    priority,
  };
}
