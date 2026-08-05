import assert from "node:assert/strict";
import test from "node:test";

import {
	FEATURE_RUNTIME_PROFILES,
	parseFeatureRuntimeArguments,
	runFeatureRuntimePreflight,
} from "./verify-feature-runtime.mjs";

void test("defines every documented capability profile", () => {
	assert.deepEqual(Object.keys(FEATURE_RUNTIME_PROFILES).sort(), [
		"app",
		"controller",
		"lead",
		"platform",
		"quality",
		"runtime",
	]);
	for (const profile of Object.values(FEATURE_RUNTIME_PROFILES)) {
		assert.deepEqual(profile.slice(0, 6), [
			"repository",
			"node",
			"pnpm",
			"git",
			"github",
			"multica",
		]);
	}
	assert.deepEqual(FEATURE_RUNTIME_PROFILES.platform.slice(-2), ["vercel", "neon"]);
	assert.equal(FEATURE_RUNTIME_PROFILES.app.at(-1), "chrome");
	assert.equal(FEATURE_RUNTIME_PROFILES.quality.at(-1), "chrome");
});

void test("parses profile, dry-run, and JSON options", () => {
	assert.deepEqual(
		parseFeatureRuntimeArguments(["--", "--profile=platform", "--dry-run", "--json"]),
		{
			dryRun: true,
			json: true,
			profile: "platform",
		},
	);
	assert.throws(() => parseFeatureRuntimeArguments(["--profile", "unknown"]), /Unknown profile/);
});

void test("dry-run plans repository and profile checks without executing commands", () => {
	let calls = 0;
	const result = runFeatureRuntimePreflight({
		dryRun: true,
		profile: "quality",
		runCommand: () => {
			calls += 1;
			return "";
		},
	});

	assert.equal(calls, 0);
	assert.equal(result.ok, true);
	assert.equal(
		result.checks.every((check) => check.status === "skipped"),
		true,
	);
	assert.deepEqual(
		result.checks.map((check) => check.capability),
		["repository", "repository", "repository", ...FEATURE_RUNTIME_PROFILES.quality.slice(1)],
	);
});

void test("runs from the resolved Git root and fails closed without command output", () => {
	const calls = [];
	const result = runFeatureRuntimePreflight({
		profile: "controller",
		runCommand: (command, arguments_, options) => {
			calls.push({ arguments_, command, options });
			if (command === "git" && arguments_.join(" ") === "rev-parse --show-toplevel") {
				return "/workspace/xiaofei\n";
			}
			if (command === "gh") {
				throw new Error("credential should not be printed");
			}
			return "sensitive command output";
		},
	});

	assert.equal(result.ok, false);
	assert.equal(result.repositoryRoot, "/workspace/xiaofei");
	assert.equal(result.checks.find((check) => check.capability === "github")?.status, "failed");
	assert.equal(Object.hasOwn(result.checks[0], "output"), false);
	assert.equal(calls[1].options.cwd, "/workspace/xiaofei");
	assert.equal(calls.at(-1).options.cwd, "/workspace/xiaofei");
});
