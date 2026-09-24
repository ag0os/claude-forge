// Asset resolution by convention for Bun compile-time bundling.
// Uses generated static import maps to avoid import.meta.glob at runtime.

type Json = unknown;

// Generated file contains static imports for all assets
// This file is created by scripts/gen-assets.ts before compilation
// eslint-disable-next-line @typescript-eslint/no-var-requires
import { SYSTEM_PROMPTS, PROMPTS, SETTINGS, MCP } from "./assets.gen";

function baseFromImporter(importerUrl: string): string {
  // importerUrl is like file:///.../agents/tools/webfetch.ts
  const pathname = new URL(importerUrl).pathname;
  const file = pathname.split("/").pop() ?? "";
  const dot = file.lastIndexOf(".");
  return dot >= 0 ? file.slice(0, dot) : file;
}

function key(dir: string, name: string) {
  return `../${dir}/${name}`;
}

export type AgentAssets = {
  systemPrompt?: string;
  prompt?: string;
  settings?: Json;
  mcp?: Json;
};

export function assetsFor(importerUrl: string): AgentAssets {
  const base = baseFromImporter(importerUrl);

  // Convention-based filenames
  const sysKey = key("system-prompts", `${base}-prompt.md`);
  const promptKey = key("prompts", `${base}.md`);
  const settingsKey = key("settings", `${base}.settings.json`);
  const mcpKey = key("settings", `${base}.mcp.json`);

  return {
    systemPrompt: (SYSTEM_PROMPTS as Record<string, string>)[base],
    prompt: (PROMPTS as Record<string, string>)[base],
    settings: (SETTINGS as Record<string, Json>)[base],
    mcp: (MCP as Record<string, Json>)[base],
  };
}
