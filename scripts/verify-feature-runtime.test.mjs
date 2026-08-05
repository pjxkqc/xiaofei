import assert from "node:assert/strict";
import test from "node:test";

import {
	FEATURE_RUNTIME_PROFILES,
	parseFeatureRuntimeArguments,
	runFeatureRuntimePreflight,
	resolveFeatureRuntimeExecutable,
	resolveFeatureRuntimeInvocation,
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

void test("resolves npm shims on Windows", () => {
	assert.equal(resolveFeatureRuntimeExecutable("pnpm", "win32"), "pnpm.cmd");
	assert.equal(resolveFeatureRuntimeExecutable("vercel", "win32"), "vercel.cmd");
	assert.equal(resolveFeatureRuntimeExecutable("neonctl", "win32"), "neonctl.cmd");
	assert.equal(resolveFeatureRuntimeExecutable("git", "win32"), "git");
});

void test("invokes Windows command shims through cmd.exe with static arguments", () => {
	assert.deepEqual(
		resolveFeatureRuntimeInvocation(
			"pnpm",
			["--version"],
			"win32",
			"C:\\Windows\\System32\\cmd.exe",
		),
		{
			executable: "C:\\Windows\\System32\\cmd.exe",
			arguments: ["/d", "/s", "/c", "pnpm.cmd", "--version"],
		},
	);
	assert.deepEqual(
		resolveFeatureRuntimeInvocation("vercel", ["whoami"], "win32", "cmd.exe").arguments,
		["/d", "/s", "/c", "vercel.cmd", "whoami"],
	);
});

void test("keeps direct invocation unchanged outside Windows shims", () => {
	assert.deepEqual(resolveFeatureRuntimeInvocation("pnpm", ["--version"], "darwin"), {
		executable: "pnpm",
		arguments: ["--version"],
	});
	assert.deepEqual(resolveFeatureRuntimeInvocation("git", ["--version"], "win32", "cmd.exe"), {
		executable: "git",
		arguments: ["--version"],
	});
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
		[
			"repository",
			"repository",
			"repository-target",
			"github-target",
			"multica-project",
			"repository",
			"identity",
			...FEATURE_RUNTIME_PROFILES.quality.slice(1),
		],
	);
});

void test("validates the Xiaofei targets and agent identity without exposing values", () => {
	const environment = Object.fromEntries(
		[
			"XIAOFEI_AGENT_ID",
			"XIAOFEI_AGENT_ROLE",
			"XIAOFEI_RUNTIME_ID",
			"XIAOFEI_RUNTIME_TAG",
			"XIAOFEI_RUNTIME_OS",
		].map((name) => [name, "present-but-secret"]),
	);
	const result = runFeatureRuntimePreflight({
		arch: "x64",
		environment,
		platform: "win32",
		profile: "runtime",
		runCommand: (command, arguments_) => {
			if (command === "git" && arguments_.join(" ") === "rev-parse --show-toplevel") {
				return "C:/work/xiaofei\n";
			}
			if (command === "git" && arguments_.join(" ") === "remote get-url origin") {
				return "git@github.com:pjxkqc/xiaofei.git\n";
			}
			return "hidden output";
		},
	});

	assert.equal(result.ok, true);
	assert.equal(result.platform, "win32");
	assert.equal(result.arch, "x64");
	assert.equal(result.checks.find((check) => check.capability === "identity")?.status, "passed");
	assert.equal(
		result.checks.find((check) => check.capability === "repository-target")?.status,
		"passed",
	);
	assert.equal(JSON.stringify(result).includes("present-but-secret"), false);
	assert.equal(JSON.stringify(result).includes("C:/work/xiaofei"), false);
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
	assert.equal(result.repositoryRootResolved, true);
	assert.equal("repositoryRoot" in result, false);
	assert.equal(result.checks.find((check) => check.capability === "github")?.status, "failed");
	assert.equal(Object.hasOwn(result.checks[0], "output"), false);
	assert.equal(calls[1].options.cwd, "/workspace/xiaofei");
	assert.equal(calls.at(-1).options.cwd, "/workspace/xiaofei");
});
