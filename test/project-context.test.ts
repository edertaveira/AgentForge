import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  assertProjectClean,
  initializeProject,
  loadProjectContext,
} from "../src/core/project-context.js";

test("initializes a project from the current repository directory", async () => {
  const repository = await createRepository();
  const project = path.join(repository, "apps/taskboard");
  await mkdir(project, { recursive: true });
  await writeFile(path.join(project, "package.json"), "{}\n");
  git(repository, ["add", "."]);
  git(repository, ["commit", "-m", "initial"]);

  const initialized = await initializeProject(project);
  const loaded = await loadProjectContext(project);

  assert.equal(initialized.config.targetDirectory, "apps/taskboard");
  assert.equal(initialized.config.repository, "git@github.com:example/taskboard.git");
  assert.equal(loaded.config.projectName, "taskboard");
  assert.doesNotThrow(() => assertProjectClean(loaded));
});

test("refuses to run against uncommitted target changes", async () => {
  const repository = await createRepository();
  await writeFile(path.join(repository, "package.json"), "{}\n");
  git(repository, ["add", "."]);
  git(repository, ["commit", "-m", "initial"]);
  const context = await initializeProject(repository);
  await writeFile(path.join(repository, "package.json"), "{\"dirty\":true}\n");

  assert.throws(() => assertProjectClean(context), /uncommitted changes/);
});

async function createRepository(): Promise<string> {
  const repository = await mkdtemp(path.join(os.tmpdir(), "agentforge-project-"));
  git(repository, ["init", "--initial-branch=main"]);
  git(repository, ["config", "user.email", "test@example.invalid"]);
  git(repository, ["config", "user.name", "AgentForge Test"]);
  git(repository, ["remote", "add", "origin", "git@github.com:example/taskboard.git"]);
  return repository;
}

function git(cwd: string, args: string[]): void {
  execFileSync("git", args, { cwd, stdio: "ignore" });
}
