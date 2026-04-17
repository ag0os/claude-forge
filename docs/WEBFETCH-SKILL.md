# WebFetch Wrapper Skill

Use `tools:webfetch` when an agent needs to fetch and analyze one public URL but does not have native web or MCP access.

## What It Is

- A one-shot wrapper around Claude Code's `WebFetch` tool.
- Best for extraction, focused Q&A, and short summaries.
- Not a browser, crawler, or byte-for-byte downloader.

## How To Use It

- Pass one fully-qualified URL.
- Give a narrow prompt: ask for a table, list, answer, section, or example.
- Prefer explicit extraction over "summarize the whole site".
- Use `--raw` only for best-effort page text, not exact source reproduction.

## Behavioral Constraints

- Claude Code WebFetch usually fetches the page, converts HTML to markdown, and applies a small model to the content.
- Large pages may be truncated or summarized.
- Cross-host redirects may require a second fetch to the redirect URL.
- Authenticated, private, JS-heavy, paywalled, or GitHub-native pages may fail or be degraded.
- On failure the wrapper returns `ERROR: ...`; if the requested information is absent it should return `UNKNOWN`.

## Good Prompt Shapes

- `list the CLI flags and one-line meanings`
- `extract the pricing tiers and monthly cost`
- `answer: does this page document streaming support?`
- `return only the code example for middleware configuration`

## Avoid

- `give me the whole page verbatim`
- `summarize everything on this website`
- prompts that require login, browser state, or JavaScript execution

## Copyable Guidance

```md
Use `tools:webfetch` for one public URL when you need fetch-and-extract behavior.

Rules:
- Give one full URL.
- Ask for one narrow thing: a list, table, answer, section, or example.
- Treat `--raw` as best-effort page text, not a byte-for-byte dump.
- If the page redirects to another host, retry with the redirect URL.
- If the page is authenticated, private, blocked, JS-only, or insufficient, return `ERROR:` or `UNKNOWN` instead of guessing.
```
