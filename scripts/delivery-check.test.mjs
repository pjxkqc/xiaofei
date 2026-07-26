import assert from "node:assert/strict";
import test from "node:test";

import {
	DELIVERY_COMMANDS,
	createDeliveryEnvironment,
	runDeliveryChecks,
} from "./delivery-check.mjs";

void test("fills only missing delivery environment values", () => {
	const environment = createDeliveryEnvironment({
		DATABASE_URL: "postgresql://configured",
		OPENAI_API_KEY: "",
	});

	assert.equal(environment.DATABASE_URL, "postgresql://configured");
	assert.equal(environment.OPENAI_API_KEY, "local-delivery-placeholder");
	assert.equal(environment.NEXT_PUBLIC_SAAS_URL, "http://localhost:3000");
});

void test("runs the complete delivery gate in fail-fast order", () => {
	const calls = [];
	const status = runDeliveryChecks({
		environment: { TEST_ENV: "present" },
		runCommand: (command, arguments_, environment) => {
			calls.push({ arguments_, command, environment });
			return { status: 0 };
		},
	});

	assert.equal(status, 0);
	assert.deepEqual(
		calls.map(({ arguments_, command }) => [command, arguments_]),
		DELIVERY_COMMANDS,
	);
	assert.equal(calls[0].environment.TEST_ENV, "present");
	assert.deepEqual(DELIVERY_COMMANDS[1], ["pnpm", ["--filter", "@repo/database", "generate"]]);
});

void test("stops at the first failing delivery command", () => {
	let callCount = 0;
	const status = runDeliveryChecks({
		runCommand: () => {
			callCount += 1;
			return { status: callCount === 3 ? 2 : 0 };
		},
	});

	assert.equal(status, 2);
	assert.equal(callCount, 3);
});
