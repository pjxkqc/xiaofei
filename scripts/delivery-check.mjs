import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const DELIVERY_ENV_DEFAULTS = {
	BETTER_AUTH_SECRET: "local-delivery-only-secret-with-at-least-32-characters",
	DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/xiaofei_delivery",
	DATABASE_URL_UNPOOLED: "postgresql://postgres:postgres@127.0.0.1:5432/xiaofei_delivery",
	DIRECT_URL: "postgresql://postgres:postgres@127.0.0.1:5432/xiaofei_delivery",
	MAIL_FROM: "noreply@example.test",
	MAIL_PROVIDER: "console",
	NEXT_PUBLIC_DOCS_URL: "http://localhost:3001",
	NEXT_PUBLIC_MARKETING_URL: "http://localhost:3001",
	NEXT_PUBLIC_SAAS_URL: "http://localhost:3000",
	OPENAI_API_KEY: "local-delivery-placeholder",
	OPENAI_BASE_URL: "https://example.test/v1",
	OPENAI_MODEL: "gpt-4o-mini",
};

export const DELIVERY_COMMANDS = [
	["node", ["scripts/verify-delivery-identity.mjs"]],
	["pnpm", ["format:check"]],
	["pnpm", ["lint"]],
	["pnpm", ["type-check"]],
	["pnpm", ["test"]],
	["pnpm", ["build"]],
];

export function createDeliveryEnvironment(environment = process.env) {
	const deliveryEnvironment = { ...environment };

	for (const [name, fallback] of Object.entries(DELIVERY_ENV_DEFAULTS)) {
		if (!deliveryEnvironment[name]?.trim()) {
			deliveryEnvironment[name] = fallback;
		}
	}

	return deliveryEnvironment;
}

export function runDeliveryChecks({
	environment = createDeliveryEnvironment(),
	runCommand = runCommandWithInheritedOutput,
} = {}) {
	for (const [command, arguments_] of DELIVERY_COMMANDS) {
		const result = runCommand(command, arguments_, environment);

		if (result.status !== 0) {
			return result.status ?? 1;
		}
	}

	return 0;
}

function runCommandWithInheritedOutput(command, arguments_, environment) {
	const executable = process.platform === "win32" && command === "pnpm" ? "pnpm.cmd" : command;

	return spawnSync(executable, arguments_, {
		env: environment,
		stdio: "inherit",
	});
}

function main() {
	const exitCode = runDeliveryChecks();

	if (exitCode !== 0) {
		process.exitCode = exitCode;
		return;
	}

	console.log("Delivery preflight passed.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main();
}
