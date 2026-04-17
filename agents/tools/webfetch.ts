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
import { runAgentOnce } from "../../lib";
import { assetsFor } from "../../lib/assets";

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
- **--raw**: return the page's main text verbatim with light whitespace
  normalization. Overrides the prompt's summarization behavior.
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
- **Raw**: \`--raw\` or prompts like \`"give me the raw text"\`.

## Examples

    tools:webfetch https://docs.bun.sh/cli
    tools:webfetch https://example.com/pricing "list the tiers and monthly cost"
    tools:webfetch --url https://api.example.com/docs --prompt "enumerate endpoints" --model sonnet
    tools:webfetch https://news.site/article --raw

## Limitations

- Follows one URL per call. Loop externally for multiple URLs.
- Cannot execute JavaScript. Pages requiring JS rendering return \`ERROR:\`.
- Respects robots / paywalls; blocked fetches return \`ERROR:\`.
- No caching between calls. Repeated fetches re-hit the origin.
- Only the \`WebFetch\` tool is permitted in the inner agent — no file IO,
  no shell, no search.

## Exit codes

- \`0\` — success, payload on stdout.
- \`64\` — usage error (missing URL).
- non-zero otherwise — fetch or agent failure (see stdout \`ERROR:\` line).
`;

const { values, positionals } = parseArgs({
	args: Bun.argv.slice(2),
	options: {
		url: { type: "string" },
		prompt: { type: "string" },
		raw: { type: "boolean", default: false },
		model: { type: "string", default: "haiku" },
		"max-turns": { type: "string" },
		describe: { type: "boolean", default: false },
		help: { type: "boolean", short: "h", default: false },
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
	process.stdout.write(USAGE_DOC);
	process.exit(0);
}

const url =
	typeof values.url === "string" && values.url.length > 0
		? values.url
		: positionals[0];

if (!url) {
	process.stderr.write(
		"ERROR: missing URL. Run `tools:webfetch --describe` for usage.\n",
	);
	process.exit(64);
}

const promptFromFlag =
	typeof values.prompt === "string" ? values.prompt.trim() : "";
const promptFromPositionals =
	typeof values.url === "string"
		? positionals.join(" ").trim()
		: positionals.slice(1).join(" ").trim();
const userPrompt = promptFromFlag || promptFromPositionals;

const maxTurnsRaw = values["max-turns"];
const maxTurns =
	typeof maxTurnsRaw === "string" && Number.isFinite(Number(maxTurnsRaw))
		? Math.max(1, Math.floor(Number(maxTurnsRaw)))
		: 3;

const model = typeof values.model === "string" ? values.model : "haiku";

const taskPrompt = values.raw
	? `Call WebFetch on this URL and return the page's main textual content as close to verbatim as possible, stripping only navigation, cookie banners, and footers. No summary, no commentary.\n\nURL: ${url}`
	: userPrompt
		? `Call WebFetch on this URL, then satisfy the caller's request below using the fetched content.\n\nURL: ${url}\n\nCaller request:\n${userPrompt}`
		: `Call WebFetch on this URL and emit a concise factual summary of the page's main content. No preamble.\n\nURL: ${url}`;

const { systemPrompt, settings } = assetsFor(import.meta.url);

const result = await runAgentOnce({
	prompt: taskPrompt,
	systemPrompt,
	settings: settings ? JSON.stringify(settings) : undefined,
	model,
	maxTurns,
	tools: { allowed: ["WebFetch"] },
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.exitCode);
