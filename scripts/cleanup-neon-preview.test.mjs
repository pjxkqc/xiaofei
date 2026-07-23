import assert from "node:assert/strict";
import test from "node:test";

import { cleanupNeonPreview } from "./cleanup-neon-preview.mjs";

void test("deletes only the exact disposable branch and hides the API key from logs", async () => {
	const requests = [];
	const logs = [];
	const apiKey = "neon-test-secret";

	const result = await cleanupNeonPreview({
		apiKey,
		projectId: "project-test",
		gitBranch: "agent/chatbot",
		logger: { log: (message) => logs.push(message) },
		fetchImpl: async (url, init) => {
			requests.push({ init, url: url.href });

			if (init.method === "DELETE") {
				return new Response(null, { status: 204 });
			}

			return Response.json({
				branches: [
					{ id: "br-main", name: "main" },
					{ id: "br-preview", name: "preview/agent/chatbot" },
				],
			});
		},
	});

	assert.deepEqual(result, {
		branchName: "preview/agent/chatbot",
		status: "deleted",
	});
	assert.equal(requests.length, 2);
	assert.match(requests[1].url, /branches\/br-preview\?hard_delete=true$/);
	assert.equal(requests[1].init.method, "DELETE");
	assert.equal(requests[1].init.headers.authorization, `Bearer ${apiKey}`);
	assert.equal(
		logs.some((message) => message.includes(apiKey)),
		false,
	);
});

void test("succeeds without a delete when the Preview branch is already absent", async () => {
	let requestCount = 0;

	const result = await cleanupNeonPreview({
		apiKey: "neon-test-secret",
		projectId: "project-test",
		gitBranch: "already-clean",
		logger: { log: () => undefined },
		fetchImpl: async () => {
			requestCount += 1;
			return Response.json({ branches: [{ id: "br-main", name: "main" }] });
		},
	});

	assert.deepEqual(result, {
		branchName: "preview/already-clean",
		status: "absent",
	});
	assert.equal(requestCount, 1);
});

void test("fails by variable name when required configuration is missing", async () => {
	await assert.rejects(
		cleanupNeonPreview({
			apiKey: "",
			projectId: "project-test",
			gitBranch: "agent/chatbot",
		}),
		/NEON_API_KEY is required/,
	);
});
