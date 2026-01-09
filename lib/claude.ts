/**
 * Wrapper for spawning Claude CLI commands
 * 
 */

/*
with_gemini(){
  local __gemini_api_key
  __gemini_api_key=$(op item get "GEMINI_API_KEY_FREE" --fields credential --reveal | tr -d '\n')

  if [[ -z $__gemini_api_key ]]; then
    echo "with_gemini: 1Password returned nothing 🤷‍♂️" >&2
    return 1
  fi

  GEMINI_API_KEY="$__gemini_api_key" "$@"
}*/

/*
zsh alias:
vid(){
  with_gemini /Users/johnlindquist/dev/claude-agents/bin/claude-video "$@"
}
*/
import { mkdtempSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, normalize } from "node:path";
import { $, spawn, type Subprocess } from "bun";
import type { ClaudeFlags } from "./claude-flags.types";
import { buildClaudeFlags } from "./flags";

/**
 * Get the path to the Claude CLI executable.
 *
 * Checks CLAUDE_PATH environment variable first, then falls back to
 * finding claude in the system PATH.
 *
 * @returns Promise resolving to the path of the Claude executable
 * @throws Error if Claude CLI is not found
 *
 * @example
 * ```ts
 * const claudePath = await getClaudeExecutablePath();
 * // Use with SDK: pathToClaudeCodeExecutable: claudePath
 * ```
 */
export async function getClaudeExecutablePath(): Promise<string> {
	// Check for CLAUDE_PATH environment variable first
	if (process.env.CLAUDE_PATH) {
		return process.env.CLAUDE_PATH;
	}

	try {
		const cmd = process.platform === "win32" ? "where" : "which";
		const result = (await $`${cmd} claude`.text()).trim();
		if (!result) {
			throw new Error("Claude CLI not found in PATH");
		}
		return result;
	} catch {
		throw new Error(
			"Claude CLI not found. Install with: npm install -g @anthropic-ai/claude-code\n" +
				"Or set CLAUDE_PATH environment variable to your Claude executable path.",
		);
	}
}

/**
 * Get the Claude projects path for the current working directory
 * @returns The path to the Claude project directory for the current pwd
 */
export async function getClaudeProjectsPath(): Promise<string> {
  const pwd = process.platform === 'win32'
    ? await $`cd`.quiet().text()
    : await $`pwd`.quiet().text();

  // Normalize the path first, then replace separators and dots
  const normalizedPwd = normalize(pwd.trim());
  const dasherizedPwd = normalizedPwd.replace(/[/\\.]/g, "-");

  const projectPath = join(
    homedir(),
    ".claude",
    "projects",
    dasherizedPwd,
  );

  return projectPath;
}

/**
 * Options for spawning Claude
 */
export interface SpawnClaudeOptions {
  /** Command line arguments to pass to claude */
  args?: string[];
  /** Environment variables to set (merged with process.env) */
  env?: Record<string, string>;
  /** Working directory for the spawned process */
  cwd?: string;
  /** Set to "pipe" to capture stdout instead of inheriting */
  stdout?: "inherit" | "pipe";
  /** Set to "pipe" to capture stderr instead of inheriting */
  stderr?: "inherit" | "pipe";
}

/**
 * Result from spawnClaude including cleanup function
 */
export interface SpawnClaudeResult {
  /** The spawned subprocess */
  process: Subprocess;
  /** Call this to clean up the temp directory (also called automatically on exit) */
  cleanup: () => void;
  /** The temp directory created for this process */
  tmpDir: string;
}

/**
 * Spawn Claude CLI with a clean temp directory to avoid file watcher errors.
 *
 * Claude Code CLI can fail to watch socket files (.sock) in the shared temp directory,
 * causing unhandled promise rejection errors. This function creates an isolated temp
 * directory for each spawned process.
 *
 * @param options - Spawn options
 * @returns SpawnClaudeResult with process handle and cleanup function
 *
 * @example
 * ```ts
 * const { process, cleanup } = spawnClaude({
 *   args: ["--settings", JSON.stringify(settings)],
 *   env: { CLAUDE_PROJECT_DIR: projectRoot }
 * });
 *
 * // Handle signals
 * process.on("SIGINT", cleanup);
 *
 * await process.exited;
 * cleanup();
 * ```
 */
export function spawnClaude(options: SpawnClaudeOptions = {}): SpawnClaudeResult {
  const { args = [], env = {}, cwd, stdout = "inherit", stderr = "inherit" } = options;

  // Create a clean temp directory to avoid file watcher errors on socket files
  const cleanTmpDir = mkdtempSync(join(tmpdir(), "claude-agent-"));

  const process = spawn(["claude", ...args], {
    stdin: "inherit",
    stdout,
    stderr,
    cwd,
    env: {
      ...globalThis.process.env,
      ...env,
      TMPDIR: cleanTmpDir,
    },
  });

  const cleanup = () => {
    try {
      rmSync(cleanTmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  };

  return { process, cleanup, tmpDir: cleanTmpDir };
}

/**
 * Spawn Claude and wait for completion, handling cleanup automatically.
 *
 * This is a convenience wrapper around spawnClaude for simple use cases.
 *
 * @param options - Spawn options
 * @returns Promise that resolves to the exit code
 */
export async function spawnClaudeAndWait(options: SpawnClaudeOptions = {}): Promise<number> {
  const { process, cleanup } = spawnClaude(options);

  const onExit = () => {
    try {
      process.kill("SIGTERM");
    } catch {}
    cleanup();
  };

  globalThis.process.on("SIGINT", onExit);
  globalThis.process.on("SIGTERM", onExit);

  await process.exited;
  cleanup();

  return process.exitCode ?? 0;
}

/**
 * Spawn Claude with given default flags and wait for completion
 * Automatically includes positionals from command line and merges with user flags
 * @param defaultFlags - Default flags object (see ClaudeFlags for available options)
 * @returns Exit code from the Claude process
 * @deprecated Use spawnClaudeAndWait instead for better temp directory handling
 */
export async function claude(prompt: string = "", defaultFlags: ClaudeFlags = {}) {
  // Build flags, merging defaults with user-provided flags
  const flags = buildClaudeFlags(defaultFlags);

  const { process, cleanup } = spawnClaude({
    args: [...flags, prompt],
  });

  await process.exited;
  cleanup();

  return process.exitCode ?? 0;
}