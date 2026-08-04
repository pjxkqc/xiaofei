import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeDatabaseUrl = process.env.DATABASE_URL?.trim();
const schemaDatabaseUrl =
	process.env.DATABASE_URL_UNPOOLED?.trim() || process.env.DIRECT_URL?.trim();

if (!runtimeDatabaseUrl) {
	throw new Error("DATABASE_URL is required.");
}

if (!schemaDatabaseUrl) {
	throw new Error("DATABASE_URL_UNPOOLED or DIRECT_URL is required.");
}

runPnpm(
	[
		"--filter",
		"@repo/database",
		"exec",
		"prisma",
		"db",
		"execute",
		"--file",
		"prisma/safe-email-mirror-constraints.sql",
	],
	{
		...process.env,
		DATABASE_URL: schemaDatabaseUrl,
	},
);

runPnpm(["--filter", "@repo/database", "push"], {
	...process.env,
	DATABASE_URL: schemaDatabaseUrl,
});

runPnpm(["--filter", "@repo/database", "generate"], {
	...process.env,
	DATABASE_URL: schemaDatabaseUrl,
});

runPnpm(["--filter", "saas", "build"], {
	...process.env,
	DATABASE_URL: runtimeDatabaseUrl,
});

function runPnpm(args, environment) {
	const result = spawnSync("pnpm", args, {
		cwd: repositoryRoot,
		env: environment,
		stdio: "inherit",
	});

	if (result.error) {
		throw result.error;
	}

	if (result.status !== 0) {
		throw new Error(`pnpm ${args.join(" ")} failed with exit code ${result.status}.`);
	}
}
