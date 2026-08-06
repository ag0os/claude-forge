import { basename, dirname, relative, resolve } from "node:path";

/**
 * Convert an agent source path to its namespaced binary name.
 * - Outside agents/: plain filename
 * - agents/foo.ts → foo
 * - agents/tasks/manager.ts → tasks:manager
 * - agents/design/diagram/all.ts → design:diagram:all
 */
export function toBinaryName(filePath: string, cwd = process.cwd()): string {
	const agentsDir = resolve(cwd, "agents");
	const base = basename(filePath).replace(/\.tsx?$/, "");

	const relativePath = relative(agentsDir, filePath);
	if (relativePath.startsWith("..") || relativePath === filePath) {
		return base;
	}

	const dir = dirname(relativePath);
	if (dir === ".") return base;

	return `${dir.split("/").join(":")}:${base}`;
}
