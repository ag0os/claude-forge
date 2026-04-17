#!/usr/bin/env bun

/**
 * tools:webfetch — Print-mode WebFetch utility for external agent systems
 *
 * Wraps Claude Code's WebFetch tool in a one-shot, non-interactive binary.
 * Designed to be invoked as a sub-tool by agents or automation that lack
 * WebFetch (or MCP) access of their own. The agent's stdout is the payload.
 *
 * Usage:
 *   tools:webfetch <url> [prompt...]
 *   tools:webfetch --url <url> --prompt "extract the pricing tiers"
 *   tools:webfetch --describe                # print self-documentation
 *   tools:webfetch                           # same as --describe
 *
 * Options:
 *   --url <url>          URL to fetch (or pass as first positional).
 *   --prompt <text>      What to extract / ask about the page. If omitted a
 *                        concise factual summary is returned.
 *   --raw                Return the page text close to verbatim (no summary).
 *   --model <name>       Claude model to use (default: haiku).
 *   --max-turns <n>      Max turns for the underlying agent (default: 3).
 *   --describe           Print self-documentation and exit.
 *   -h, --help           Alias for --describe.
 */

import { parseArgs } from "node:util";
import { type RunResult, runAgentOnce } from "../../lib";
import { type AgentAssets, assetsFor } from "../../lib/assets";

const USAGE_DOC = `# tools:webfetch

Print-mode wrapper around Claude Code's WebFetch tool. Invoke it as a one-shot
sub-process from agents or automation that lack native WebFetch or MCP access.
The process writes its payload to stdout and exits.

## Synopsis

    tools:webfetch <url> [prompt...]
    tools:webfetch --url <url> --prompt "<what to extract>"
    tools:webfetch --describe

## Inputs

- **URL** (required for fetch mode): the page to retrieve. First positional
  argument, or \`--url\`.
- **Prompt** (optional): natural-language instruction describing what to pull
  from the page. Remaining positionals are joined, or \`--prompt\`.
- **--raw**: best-effort raw page text. HTML is still converted to markdown by
  Claude Code's WebFetch path, and some pages may still be truncated or
  summarized.
- **--model <name>**: Claude model (default \`haiku\`). Use \`sonnet\` or
  \`opus\` for denser extraction from complex pages.
- **--max-turns <n>**: turn cap for the underlying agent (default 3).

## Output

- stdout contains only the requested content. No preamble, no status lines,
  no markdown decoration unless your prompt explicitly asks for it.
- On failure, stdout begins with \`ERROR: <reason>\` and the process exits
  non-zero.
- Content that could not be located on the page is reported as \`UNKNOWN\`.

## Modes (implied by the prompt)

- **Summary (default)**: tight factual summary of the page's main content.
- **Extraction**: \`"list the CLI flags"\`, \`"extract the pricing table"\`,
  \`"give me the API endpoints"\` — returns only the extracted items.
- **Q&A**: \`"does this library support streaming?"\` — direct answer.
- **Raw**: \`--raw\` or prompts like \`"give me the raw text"\`. Best effort
  only; not a byte-for-byte dump.

## Prompting Tips

- Ask for one narrow thing: a table, flag list, answer, section, or code
  example.
- Prefer extraction prompts over "summarize everything on this site".
- If you need a direct answer, ask the question explicitly.
- If the page is likely authenticated, private, or GitHub-native, prefer a
  specialized tool instead of WebFetch.

## Examples

    tools:webfetch https://docs.bun.sh/cli
    tools:webfetch https://example.com/pricing "list the tiers and monthly cost"
    tools:webfetch --url https://api.example.com/docs --prompt "enumerate endpoints" --model sonnet
    tools:webfetch https://news.site/article --raw

## Limitations

- Follows one URL per call. Loop externally for multiple URLs.
- Under the hood, Claude Code's WebFetch usually fetches the page, converts
  HTML to markdown, and applies a small model to the result.
- Cannot execute JavaScript. Pages requiring JS rendering return \`ERROR:\`.
- Respects robots / paywalls; blocked fetches return \`ERROR:\`.
- Authenticated or private URLs often fail; GitHub URLs are usually better via
  \`gh\`.
- Cross-host redirects may require a second fetch to the redirect target.
- No caching between calls. Repeated fetches re-hit the origin.
- Only the \`WebFetch\` tool is permitted in the inner agent — no file IO,
  no shell, no search.

## Exit codes

- \`0\` — success, payload on stdout.
- \`64\` — usage error (missing URL).
- non-zero otherwise — fetch or agent failure (see stdout \`ERROR:\` line).
`;

const DEFAULT_MODEL = "haiku";
const DEFAULT_MAX_TURNS = 3;
const ERROR_PREFIX = "ERROR: ";

type WebfetchCliResult = {
	stdout?: string;
	stderr?: string;
	exitCode: number;
};

type WebfetchRunArgs = {
	mode: "run";
	url: string;
	userPrompt: string;
	raw: boolean;
	model: string;
	maxTurns: number;
};

type WebfetchParseResult =
	| WebfetchRunArgs
	| {
			mode: "describe" | "usage-error";
			stdout: string;
			exitCode: number;
	  };

type WebfetchDependencies = {
	runAgentOnce: typeof runAgentOnce;
	assetsFor: (importerUrl: string) => AgentAssets;
};

const DEFAULT_DEPS: WebfetchDependencies = {
	runAgentOnce,
	assetsFor,
};

export function parseWebfetchArgs(
	args: readonly string[],
): WebfetchParseResult {
	const { values, positionals } = parseArgs({
		args: [...args],
		options: {
			url: { type: "string" },
			prompt: { type: "string" },
			raw: { type: "boolean", default: false },
			model: { type: "string", default: DEFAULT_MODEL },
			"max-turns": { type: "string" },
			describe: { type: "boolean", default: false },
			help: { type: "boolean", short: "h", default: false },
			backend: { type: "string" },
		},
		strict: false,
		allowPositionals: true,
	});

	const wantsDescribe =
		values.describe === true ||
		values.help === true ||
		(positionals.length === 0 &&
			typeof values.url !== "string" &&
			typeof values.prompt !== "string");

	if (wantsDescribe) {
		return {
			mode: "describe",
			stdout: USAGE_DOC,
			exitCode: 0,
		};
	}

	const url =
		typeof values.url === "string" && values.url.length > 0
			? values.url
			: positionals[0];

	if (!url) {
		return {
			mode: "usage-error",
			stdout:
				"ERROR: missing URL. Run `tools:webfetch --describe` for usage.\n",
			exitCode: 64,
		};
	}

	const promptFromFlag =
		typeof values.prompt === "string" ? values.prompt.trim() : "";
	const promptFromPositionals =
		typeof values.url === "string"
			? positionals.join(" ").trim()
			: positionals.slice(1).join(" ").trim();

	const maxTurnsRaw = values["max-turns"];
	const maxTurns =
		typeof maxTurnsRaw === "string" && Number.isFinite(Number(maxTurnsRaw))
			? Math.max(1, Math.floor(Number(maxTurnsRaw)))
			: DEFAULT_MAX_TURNS;

	return {
		mode: "run",
		url,
		userPrompt: promptFromFlag || promptFromPositionals,
		raw: values.raw === true,
		model: typeof values.model === "string" ? values.model : DEFAULT_MODEL,
		maxTurns,
	};
}

export function buildTaskPrompt({
	raw,
	url,
	userPrompt,
}: WebfetchRunArgs): string {
	if (raw) {
		return `Call WebFetch on this URL and return the closest available raw page text with no commentary. Treat this as best-effort raw text: the underlying tool may convert HTML to markdown, truncate large pages, or summarize some content. If WebFetch reports a redirect to a different host, call WebFetch once more with the redirect URL. If the page is authenticated, private, blocked, or unavailable, return a single ERROR line instead of guessing.\n\nURL: ${url}`;
	}

	if (userPrompt) {
		return `Call WebFetch on this URL using a narrow extraction-oriented prompt that matches the caller's request. If WebFetch reports a redirect to a different host, call WebFetch once more with the redirect URL and the same intent. If the page is authenticated, private, blocked, clearly truncated, or otherwise insufficient to answer reliably, return ERROR or UNKNOWN rather than guessing.\n\nURL: ${url}\n\nCaller request:\n${userPrompt}`;
	}

	return `Call WebFetch on this URL and emit a concise factual summary of the page's main content. If WebFetch reports a redirect to a different host, call WebFetch once more with the redirect URL. If the page is authenticated, private, blocked, or unavailable, return a single ERROR line. No preamble.\n\nURL: ${url}`;
}

function startsWithError(stdout: string | undefined): boolean {
	return stdout?.trimStart().startsWith(ERROR_PREFIX) === true;
}

function firstNonEmptyLine(value: string | undefined): string | undefined {
	return value
		?.split(/\r?\n/u)
		.map((line) => line.trim())
		.find((line) => line.length > 0);
}

export function formatErrorLine(reason: string): string {
	const line = firstNonEmptyLine(reason)
		?.replace(/^ERROR:\s*/u, "")
		.trim();
	return `${ERROR_PREFIX}${line && line.length > 0 ? line : "web fetch failed"}\n`;
}

export function normalizeRunResult(result: RunResult): WebfetchCliResult {
	if (result.exitCode === 0) {
		if (startsWithError(result.stdout)) {
			return {
				stdout: result.stdout,
				exitCode: 1,
			};
		}

		return {
			stdout: result.stdout,
			stderr: result.stderr,
			exitCode: 0,
		};
	}

	if (startsWithError(result.stdout)) {
		return {
			stdout: result.stdout,
			exitCode: result.exitCode || 1,
		};
	}

	const reason =
		firstNonEmptyLine(result.stderr) ??
		firstNonEmptyLine(result.stdout) ??
		`web fetch failed with exit code ${result.exitCode}`;

	return {
		stdout: formatErrorLine(reason),
		exitCode: result.exitCode || 1,
	};
}

export async function runWebfetchCli(
	args: readonly string[],
	deps: WebfetchDependencies = DEFAULT_DEPS,
): Promise<WebfetchCliResult> {
	const parsed = parseWebfetchArgs(args);
	if (parsed.mode !== "run") {
		return parsed;
	}

	const { systemPrompt, settings } = deps.assetsFor(import.meta.url);

	try {
		const result = await deps.runAgentOnce({
			prompt: buildTaskPrompt(parsed),
			systemPrompt,
			settings: settings ? JSON.stringify(settings) : undefined,
			model: parsed.model,
			maxTurns: parsed.maxTurns,
			tools: { allowed: ["WebFetch"] },
			backend: "claude-cli",
		});

		return normalizeRunResult(result);
	} catch (error) {
		return {
			stdout: formatErrorLine(
				error instanceof Error ? error.message : String(error),
			),
			exitCode: 1,
		};
	}
}

if (import.meta.main) {
	const result = await runWebfetchCli(Bun.argv.slice(2));

	if (result.stdout) process.stdout.write(result.stdout);
	if (result.stderr) process.stderr.write(result.stderr);
	process.exit(result.exitCode);
}
