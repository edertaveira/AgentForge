const MINIMUM_NODE_MAJOR = 22;

export function assertSupportedRuntime(version = process.versions.node): void {
  const [majorText] = version.split(".");
  const major = Number(majorText);

  if (!Number.isInteger(major) || major < MINIMUM_NODE_MAJOR) {
    throw new Error(
      `AgentForge requires Node.js ${MINIMUM_NODE_MAJOR} or newer; current version is ${version}. ` +
        "Install a supported Node.js version before running the demo.",
    );
  }
}
