#!/usr/bin/env bun

import { $ } from "bun";
import { existsSync, watch } from "fs";
import { join, basename, relative, dirname } from "path";
import { readdir, unlink } from "fs/promises";

const agentsDir = join(process.cwd(), "agents");
const systemPromptsDir = join(process.cwd(), "system-prompts");
const settingsDir = join(process.cwd(), "settings");
const binDir = join(process.cwd(), "bin");

console.log(
  `Watching agents, system-prompts, settings for changes...`,
);
console.log("Will rebuild ALL agents on any change in these directories");

// Track existing agent files: Map<relativePath, binaryName>
let knownAgents = new Map<string, string>();

/**
 * Convert a relative path to a namespaced binary name
 * - Root level: agents/foo.ts → foo
 * - Subdirectory: agents/forge-tasks/manager.ts → forge-tasks:manager
 */
function toBinaryName(relativePath: string): string {
  const dir = dirname(relativePath);
  const base = basename(relativePath, ".ts").replace(".tsx", "");

  if (dir === ".") {
    // Root level agent, no namespace
    return base;
  }

  // Subdirectory agent, use colon-separated namespace
  // Handle nested dirs: a/b/c.ts → a:b:c
  const namespace = dir.split("/").join(":");
  return `${namespace}:${base}`;
}

/**
 * Recursively scan for agent files in a directory
 */
async function scanDirectory(dir: string, baseDir: string): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        // Recurse into subdirectory
        const subResults = await scanDirectory(fullPath, baseDir);
        for (const [path, binary] of subResults) {
          results.set(path, binary);
        }
      } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
        // Found an agent file
        const relativePath = relative(baseDir, fullPath);
        const binaryName = toBinaryName(relativePath);
        results.set(relativePath, binaryName);
      }
    }
  } catch (error) {
    console.error(`Failed to scan directory ${dir}:`, error);
  }

  return results;
}

// Function to get current agent files
async function getCurrentAgents(): Promise<Map<string, string>> {
  return scanDirectory(agentsDir, agentsDir);
}

// Function to compile all agents and handle deletions
async function compileAllAgents() {
  console.log("Rebuilding all agents...");

  try {
    // Always regenerate asset maps first so builds inline latest files
    try {
      console.log("  Generating asset maps...");
      await $`bun scripts/gen-assets.ts`;
      console.log("  ✓ Asset maps generated");
    } catch (error) {
      console.error("  ✗ Failed to generate asset maps:", error);
    }

    const currentAgents = await getCurrentAgents();

    // Check for deleted agents
    for (const [relativePath, binaryName] of knownAgents) {
      if (!currentAgents.has(relativePath)) {
        // Agent was deleted, remove corresponding bin file
        const binPath = join(binDir, binaryName);

        try {
          await unlink(binPath);
          console.log(`  ✓ Removed ${binaryName} from bin directory`);
        } catch (error) {
          // File might already be gone or never existed
          if (error instanceof Error) {
            console.log(`  ℹ Could not remove ${binaryName} from bin directory:`, error.message);
          } else {
            console.log(`  ℹ Could not remove ${binaryName} from bin directory:`, error);
          }
        }
      }
    }

    // Update known agents
    knownAgents = currentAgents;

    if (currentAgents.size === 0) {
      console.log("No TypeScript files found in agents directory");
      return;
    }

    console.log(`Found ${currentAgents.size} agent(s) to compile`);

    // Compile all agents
    for (const [relativePath, binaryName] of currentAgents) {
      const filePath = join(agentsDir, relativePath);
      const outputPath = `./bin/${binaryName}`;

      console.log(`  Compiling ${binaryName}...`);

      try {
        await $`bun build --compile ${filePath} --outfile ${outputPath}`;
        console.log(`  ✓ Compiled ${binaryName}`);
      } catch (error) {
        console.error(`  ✗ Failed to compile ${binaryName}:`, error);
      }
    }

    console.log("All agents rebuilt!");
  } catch (error) {
    console.error("Failed to rebuild agents:", error);
  }
}

// Debounce function to prevent multiple rapid rebuilds
let rebuildTimeout: NodeJS.Timeout | null = null;
function debouncedRebuild(dir: string, filename?: string) {
  console.log(`Change detected in ${dir}: ${filename || 'unknown'}`);

  if (rebuildTimeout) {
    clearTimeout(rebuildTimeout);
  }

  rebuildTimeout = setTimeout(() => {
    compileAllAgents();
  }, 100); // Wait 100ms after last change
}

// Create watchers (only for directories that exist)
const watchers: ReturnType<typeof watch>[] = [];

const agentsWatcher = watch(agentsDir, { recursive: true }, (event, filename) => {
  if (filename && (filename.endsWith('.ts') || filename.endsWith('.tsx'))) {
    debouncedRebuild('agents', filename);
  }
});
watchers.push(agentsWatcher);

if (existsSync(systemPromptsDir)) {
  const systemPromptsWatcher = watch(
    systemPromptsDir,
    { recursive: true },
    (event, filename) => {
      if (filename && filename.endsWith('.md')) {
        debouncedRebuild('system-prompts', filename);
      }
    },
  );
  watchers.push(systemPromptsWatcher);
}

if (existsSync(settingsDir)) {
  const settingsWatcher = watch(
    settingsDir,
    { recursive: true },
    (event, filename) => {
      if (filename && (filename.endsWith('.json'))) {
        debouncedRebuild('settings', filename);
      }
    },
  );
  watchers.push(settingsWatcher);
}

// Handle process termination
process.on("SIGINT", () => {
  console.log("\nStopping watchers...");
  for (const watcher of watchers) {
    watcher.close();
  }
  process.exit(0);
});

// Initialize known agents before first build
knownAgents = await getCurrentAgents();
console.log(`Discovered ${knownAgents.size} agent(s):`);
for (const [relativePath, binaryName] of knownAgents) {
  console.log(`  ${relativePath} → ${binaryName}`);
}

// Do an initial build
console.log("Performing initial build...");
await compileAllAgents();

// Keep the process running
console.log("\nWatching for changes... Press Ctrl+C to stop.");
