export function createTask(title) {
  if (typeof title !== "string" || title.trim() === "") {
    throw new Error("title is required");
  }

  return {
    title: title.trim(),
    status: "open",
  };
}
