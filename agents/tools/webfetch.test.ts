import { describe, expect, test } from "bun:test";
import {
	normalizeRunResult,
	parseWebfetchArgs,
	runWebfetchCli,
} from "./webfetch";

describe("parseWebfetchArgs", () => {
	test("consumes repo-level backend flag before deriving the URL", () => {
		const result = parseWebfetchArgs([
			"--backend",
			"claude-cli",
			"https://example.com",
			"extract",
			"pricing",
		]);

		expect(result.mode).toBe("run");
		if (result.mode !== "run") {
			throw new Error("expected run mode");
		}

		expect(result.url).toBe("https://example.com");
		expect(result.userPrompt).toBe("extract pricing");
	});
});

describe("normalizeRunResult", () => {
	test("turns model-reported ERROR payloads into non-zero failures", () => {
		const result = normalizeRunResult({
			exitCode: 0,
			stdout: "ERROR: 404 Not Found\n",
			completionMarkerFound: false,
		});

		expect(result.stdout).toBe("ERROR: 404 Not Found\n");
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toBeUndefined();
	});

	test("synthesizes ERROR stdout from non-zero runtime failures", () => {
		const result = normalizeRunResult({
			exitCode: 17,
			stderr: "backend unavailable\nstack trace",
			completionMarkerFound: false,
		});

		expect(result.stdout).toBe("ERROR: backend unavailable\n");
		expect(result.exitCode).toBe(17);
		expect(result.stderr).toBeUndefined();
	});
});

describe("runWebfetchCli", () => {
	test("pins the inner execution backend to claude-cli", async () => {
		let calls = 0;
		let capturedBackend: string | undefined;

		const runAgentOnceMock = async (options: Record<string, unknown>) => {
			calls += 1;
			capturedBackend =
				typeof options.backend === "string" ? options.backend : undefined;

			return {
				exitCode: 0,
				stdout: "ok",
				completionMarkerFound: false,
			};
		};

		const result = await runWebfetchCli(
			["--backend", "codex-cli", "https://example.com"],
			{
				runAgentOnce: runAgentOnceMock,
				assetsFor: () => ({
					systemPrompt: "system",
					settings: { mode: "test" },
				}),
			},
		);

		expect(calls).toBe(1);
		expect(capturedBackend).toBe("claude-cli");
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toBe("ok");
	});

	test("maps thrown runtime failures to the documented ERROR contract", async () => {
		const result = await runWebfetchCli(["https://example.com"], {
			runAgentOnce: async () => {
				throw new Error('Backend "claude-cli" is not available.');
			},
			assetsFor: () => ({
				systemPrompt: "system",
				settings: { mode: "test" },
			}),
		});

		expect(result.exitCode).toBe(1);
		expect(result.stdout).toBe(
			'ERROR: Backend "claude-cli" is not available.\n',
		);
		expect(result.stderr).toBeUndefined();
	});
});
