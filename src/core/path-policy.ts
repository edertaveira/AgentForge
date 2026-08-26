import path from "node:path";

export function resolveInside(root: string, requestedPath: string): string {
  const absoluteRoot = path.resolve(root);
  const resolved = path.resolve(absoluteRoot, requestedPath);
  const relative = path.relative(absoluteRoot, resolved);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path escapes authorized workspace: ${requestedPath}`);
  }

  return resolved;
}
