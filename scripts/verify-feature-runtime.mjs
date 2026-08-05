import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const FEATURE_RUNTIME_PROFILES = {
	app: ["repository", "node", "pnpm", "git", "github", "multica", "chrome"],
	controller: ["repository", "node", "pnpm", "git", "github", "multica"],
	lead: ["repository", "node", "pnpm", "git", "github", "multica"],
	platform: ["repository", "node", "pnpm", "git", "github", "multica", "vercel", "neon"],
	quality: ["repository", "node", "pnpm", "git", "github", "multica", "vercel", "neon", "chrome"],
	runtime: ["repository", "node", "pnpm", "git", "github", "multica"],
};

const CAPABILITY_COMMANDS = {
	chrome: ["pnpm", ["exec", "playwright", "--version"]],
	git: ["git", ["--version"]],
	github: ["gh", ["auth", "status"]],
	multica: ["multica", ["auth", "status"]],
	neon: ["neonctl", ["me"]],
	node: ["node", ["--version"]],
	pnpm: ["pnpm", ["--version"]],
	vercel: ["vercel", ["whoami"]],
};

const REQUIRED_IDENTITY = {
	controller: ["CODEX_THREAD_ID"],
	app: [
		"XIAOFEI_AGENT_ID",
		"XIAOFEI_AGENT_ROLE",
		"XIAOFEI_RUNTIME_ID",
		"XIAOFEI_RUNTIME_TAG",
		"XIAOFEI_RUNTIME_OS",
	],
	lead: [
		"XIAOFEI_AGENT_ID",
		"XIAOFEI_AGENT_ROLE",
		"XIAOFEI_RUNTIME_ID",
		"XIAOFEI_RUNTIME_TAG",
		"XIAOFEI_RUNTIME_OS",
	],
	runtime: [
		"XIAOFEI_AGENT_ID",
		"XIAOFEI_AGENT_ROLE",
		"XIAOFEI_RUNTIME_ID",
		"XIAOFEI_RUNTIME_TAG",
		"XIAOFEI_RUNTIME_OS",
	],
	platform: [
		"XIAOFEI_AGENT_ID",
		"XIAOFEI_AGENT_ROLE",
		"XIAOFEI_RUNTIME_ID",
		"XIAOFEI_RUNTIME_TAG",
		"XIAOFEI_RUNTIME_OS",
	],
	quality: [
		"XIAOFEI_AGENT_ID",
		"XIAOFEI_AGENT_ROLE",
		"XIAOFEI_RUNTIME_ID",
		"XIAOFEI_RUNTIME_TAG",
		"XIAOFEI_RUNTIME_OS",
	],
};

export function parseFeatureRuntimeArguments(arguments_ = process.argv.slice(2)) {
	const options = { dryRun: false, json: false, profile: "controller" };

	for (let index = 0; index < arguments_.length; index += 1) {
		const argument = arguments_[index];

		if (argument === "--") {
			continue;
		} else if (argument === "--dry-run") {
			options.dryRun = true;
		} else if (argument === "--json") {
			options.json = true;
		} else if (argument === "--profile") {
			options.profile = arguments_[index + 1];
			index += 1;
		} else if (argument.startsWith("--profile=")) {
			options.profile = argument.slice("--profile=".length);
		} else if (argument === "--help") {
			options.help = true;
		} else {
			throw new Error(`Unknown argument: ${argument}`);
		}
	}

	if (!FEATURE_RUNTIME_PROFILES[options.profile]) {
		throw new Error(
			`Unknown profile: ${options.profile}. Expected one of ${Object.keys(FEATURE_RUNTIME_PROFILES).join(", ")}.`,
		);
	}

	return options;
}

export function runFeatureRuntimePreflight({
	arch = process.arch,
	dryRun = false,
	environment = process.env,
	platform = process.platform,
	profile = "controller",
	runCommand = runCommandWithHiddenOutput,
} = {}) {
	const capabilities = FEATURE_RUNTIME_PROFILES[profile];

	if (!capabilities) {
		throw new Error(`Unknown profile: ${profile}.`);
	}

	const checks = [];
	let repositoryRoot;

	if (dryRun) {
		checks.push(createSkippedCheck("repository", "git", ["rev-parse", "--show-toplevel"]));
		checks.push(createSkippedCheck("repository", "git", ["remote", "get-url", "origin"]));
		checks.push(createSkippedCheck("repository-target", "git", ["remote", "get-url", "origin"]));
		checks.push(createSkippedCheck("github-target", "gh", ["repo", "view", "pjxkqc/xiaofei"]));
		checks.push(
			createSkippedCheck("multica-project", "multica", [
				"project",
				"get",
				"dd543ecd-01d2-495d-a517-3c8455050581",
				"--output",
				"json",
			]),
		);
		checks.push(
			createSkippedCheck("repository", "git", [
				"show-ref",
				"--verify",
				"--quiet",
				"refs/remotes/origin/uat",
			]),
		);
	} else {
		const rootResult = executeCheck(
			"repository",
			"git",
			["rev-parse", "--show-toplevel"],
			runCommand,
		);
		checks.push(rootResult.check);
		repositoryRoot = rootResult.output?.trim();
		const remoteResult = executeCheck(
			"repository",
			"git",
			["remote", "get-url", "origin"],
			runCommand,
			repositoryRoot,
		);
		checks.push(remoteResult.check);
		checks.push({
			arguments: ["remote", "get-url", "origin"],
			capability: "repository-target",
			command: "git",
			status:
				remoteResult.check.status === "passed" && isXiaofeiRemote(remoteResult.output)
					? "passed"
					: "failed",
		});
		checks.push(
			executeCheck(
				"github-target",
				"gh",
				["repo", "view", "pjxkqc/xiaofei"],
				runCommand,
				repositoryRoot,
			).check,
		);
		checks.push(
			executeCheck(
				"multica-project",
				"multica",
				["project", "get", "dd543ecd-01d2-495d-a517-3c8455050581", "--output", "json"],
				runCommand,
				repositoryRoot,
			).check,
		);
		checks.push(
			executeCheck(
				"repository",
				"git",
				["show-ref", "--verify", "--quiet", "refs/remotes/origin/uat"],
				runCommand,
				repositoryRoot,
			).check,
		);
	}
	const identity = REQUIRED_IDENTITY[profile];
	checks.push(
		dryRun
			? createSkippedCheck("identity", "env", identity)
			: {
					arguments: identity,
					capability: "identity",
					command: "env",
					status: identity.every(
						(name) => typeof environment[name] === "string" && environment[name].length > 0,
					)
						? "passed"
						: "failed",
				},
	);

	for (const capability of capabilities.filter((capability) => capability !== "repository")) {
		const [command, arguments_] = CAPABILITY_COMMANDS[capability];
		checks.push(
			dryRun
				? createSkippedCheck(capability, command, arguments_)
				: executeCheck(capability, command, arguments_, runCommand, repositoryRoot).check,
		);
	}

	return {
		checks,
		dryRun,
		ok: checks.every((check) => check.status !== "failed"),
		profile,
		repositoryRootResolved: typeof repositoryRoot === "string" && repositoryRoot.length > 0,
		platform,
		arch,
	};
}

function isXiaofeiRemote(value) {
	const remote = String(value ?? "")
		.trim()
		.replace(/\.git$/, "");
	return remote === "pjxkqc/xiaofei" || /(?:github\.com[/:])pjxkqc\/xiaofei$/.test(remote);
}

function createSkippedCheck(capability, command, arguments_) {
	return { arguments: arguments_, capability, command, status: "skipped" };
}

function executeCheck(capability, command, arguments_, runner, cwd) {
	try {
		return {
			check: { arguments: arguments_, capability, command, status: "passed" },
			output: runner(command, arguments_, { cwd }),
		};
	} catch {
		return {
			check: { arguments: arguments_, capability, command, status: "failed" },
			output: undefined,
		};
	}
}

export function resolveFeatureRuntimeExecutable(command, platform = process.platform) {
	return platform === "win32" && ["pnpm", "vercel", "neonctl"].includes(command)
		? `${command}.cmd`
		: command;
}

export function resolveFeatureRuntimeInvocation(
	command,
	arguments_,
	platform = process.platform,
	commandProcessor = process.env.ComSpec ?? "cmd.exe",
) {
	if (platform === "win32" && ["pnpm", "vercel", "neonctl"].includes(command)) {
		return {
			executable: commandProcessor,
			arguments: ["/d", "/s", "/c", `${command}.cmd`, ...arguments_],
		};
	}

	return { executable: command, arguments: arguments_ };
}

function runCommandWithHiddenOutput(command, arguments_, { cwd } = {}) {
	const invocation = resolveFeatureRuntimeInvocation(command, arguments_);
	return execFileSync(invocation.executable, invocation.arguments, {
		cwd,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});
}

function printUsage() {
	console.log(
		"Usage: node scripts/verify-feature-runtime.mjs [--profile <name>] [--dry-run] [--json]",
	);
}

function printResult(result, json) {
	if (json) {
		console.log(JSON.stringify(result));
		return;
	}

	console.log(`Runtime preflight (${result.profile}): ${result.ok ? "passed" : "failed"}.`);
	for (const check of result.checks) {
		console.log(
			`${check.status}: ${check.capability} (${check.command} ${check.arguments.join(" ")})`,
		);
	}
}

function main() {
	try {
		const options = parseFeatureRuntimeArguments();
		if (options.help) {
			printUsage();
			return;
		}

		const result = runFeatureRuntimePreflight(options);
		printResult(result, options.json);
		if (!result.ok) {
			process.exitCode = 1;
		}
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main();
}
