import { afterEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
	process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:5432/test";
});

vi.mock("@repo/auth", () => ({ auth: { handler: vi.fn() } }));
vi.mock("@repo/logs", () => ({ logger: { log: vi.fn() } }));
vi.mock("@repo/payments", () => ({ webhookHandler: vi.fn() }));
vi.mock("@repo/utils", () => ({ getBaseUrl: () => "http://localhost:3000" }));
vi.mock("./orpc/handler", () => ({
	openApiHandler: { handle: vi.fn() },
	rpcHandler: { handle: vi.fn() },
}));
vi.mock("@repo/database", async (importOriginal) => ({
	...(await importOriginal<typeof import("@repo/database")>()),
	acceptMirroredEmailMessage: vi.fn(),
}));

import { acceptMirroredEmailMessage, XiaofeiEmailMirrorConflictError } from "@repo/database";

import { app } from "./index";

const path = "/api/xiaofei/integrations/v1/email/messages";
const body = {
	schemaVersion: "email.message.v1",
	eventId: "email:42:event",
	occurredAt: "2026-08-03T03:20:00.000Z",
	tenant: { companyId: "42" },
	channel: "email",
	channelAccount: { id: "account", address: "support@example.com" },
	conversation: { externalId: "email:42:pair", loopdeskSessionId: null },
	message: {
		sourceMessageId: "email:1",
		providerMessageId: null,
		replyToSourceMessageId: null,
		direction: "inbound",
		senderType: "customer",
		from: { address: "customer@example.com", name: null },
		to: [{ address: "support@example.com", name: null }],
		subject: null,
		content: { type: "text/plain", value: "private body" },
		attachments: [],
		labels: [],
		sourceSendType: null,
		sentAt: "2026-08-03T03:20:00.000Z",
	},
	source: { system: "mail", topic: "topic", partition: 0, offset: 1, workerVersion: "test" },
};
afterEach(() => {
	delete process.env.XIAOFEI_EMAIL_INGEST_API_KEY;
	vi.clearAllMocks();
});
describe("Email ingest HTTP route", () => {
	it("enforces exact path, auth, media, size, JSON and idempotency before persistence", async () => {
		process.env.XIAOFEI_EMAIL_INGEST_API_KEY = "secret";
		expect((await app.request(path, { method: "POST" })).status).toBe(401);
		expect(
			(
				await app.request(path, {
					method: "POST",
					headers: { Authorization: "Bearer wrong", "Content-Type": "application/json" },
					body: JSON.stringify(body),
				})
			).status,
		).toBe(401);
		expect(
			(
				await app.request(path, {
					method: "POST",
					headers: { Authorization: "Bearer secret", "Content-Type": "text/plain" },
				})
			).status,
		).toBe(415);
		expect(
			(
				await app.request(path, {
					method: "POST",
					headers: {
						Authorization: "Bearer secret",
						"Content-Type": "application/json",
						"Content-Length": String(1024 * 1024 + 1),
					},
					body: "{}",
				})
			).status,
		).toBe(413);
		expect(
			(
				await app.request(path, {
					method: "POST",
					headers: { Authorization: "Bearer secret", "Content-Type": "application/json" },
					body: "x".repeat(1024 * 1024 + 1),
				})
			).status,
		).toBe(413);
		expect(
			(
				await app.request(path, {
					method: "POST",
					headers: { Authorization: "Bearer secret", "Content-Type": "application/json" },
					body: "{",
				})
			).status,
		).toBe(400);
		expect(
			(
				await app.request(path, {
					method: "POST",
					headers: { Authorization: "Bearer secret", "Content-Type": "application/json" },
					body: JSON.stringify({}),
				})
			).status,
		).toBe(400);
		expect(
			(
				await app.request(path, {
					method: "POST",
					headers: { Authorization: "Bearer secret", "Content-Type": "application/json" },
					body: JSON.stringify(body),
				})
			).status,
		).toBe(400);
		expect(
			(
				await app.request(path, {
					method: "POST",
					headers: {
						Authorization: "Bearer secret",
						"Content-Type": "application/json",
						"Idempotency-Key": "different-event",
					},
					body: JSON.stringify(body),
				})
			).status,
		).toBe(400);
		expect(acceptMirroredEmailMessage).not.toHaveBeenCalled();
	});
	it("returns accepted then duplicate locators without sensitive response data", async () => {
		process.env.XIAOFEI_EMAIL_INGEST_API_KEY = "secret";
		vi.mocked(acceptMirroredEmailMessage)
			.mockResolvedValueOnce({
				status: "accepted",
				conversationId: "c",
				messageId: "m",
				jobId: "j",
			} as never)
			.mockResolvedValueOnce({
				status: "duplicate",
				conversationId: "c",
				messageId: "m",
				jobId: "j",
			} as never);
		const init = {
			method: "POST",
			headers: {
				Authorization: "Bearer secret",
				"Content-Type": "application/json",
				"Idempotency-Key": body.eventId,
			},
			body: JSON.stringify(body),
		};
		const accepted = await app.request(path, init);
		const duplicate = await app.request(path, init);
		expect(accepted.status).toBe(202);
		expect(duplicate.status).toBe(200);
		expect(await accepted.text()).not.toContain("private body");
	});
	it("maps persistence conflicts and unexpected failures to stable safe responses", async () => {
		process.env.XIAOFEI_EMAIL_INGEST_API_KEY = "secret";
		const init = {
			method: "POST",
			headers: {
				Authorization: "Bearer secret",
				"Content-Type": "application/json",
				"Idempotency-Key": body.eventId,
			},
			body: JSON.stringify(body),
		};
		vi.mocked(acceptMirroredEmailMessage)
			.mockRejectedValueOnce(new XiaofeiEmailMirrorConflictError("workspace", body.eventId))
			.mockRejectedValueOnce(new Error("database secret detail"));
		const conflict = await app.request(path, init);
		const unexpected = await app.request(path, init);
		expect(conflict.status).toBe(409);
		expect(await conflict.json()).toEqual({ error: "event_conflict" });
		expect(unexpected.status).toBe(500);
		expect(await unexpected.json()).toEqual({ error: "internal_error" });
	});
});
