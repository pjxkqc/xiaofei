import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/database", () => ({
	acceptMirroredEmailMessage: vi.fn(),
	XiaofeiChannelBindingNotFoundError: class extends Error {},
	XiaofeiChannelBindingDisabledError: class extends Error {},
	XiaofeiChannelBindingConflictError: class extends Error {},
	XiaofeiEmailConversationConflictError: class extends Error {},
	XiaofeiEmailMirrorConflictError: class extends Error {},
}));

import { acceptMirroredEmailMessage } from "@repo/database";

import { ingestEmailMessage, isValidEmailIngestAuthorization } from "./email-ingest";

const valid = {
	schemaVersion: "email.message.v1",
	eventId: "email:42:one",
	occurredAt: "2026-08-03T03:20:00.000Z",
	tenant: { companyId: "42" },
	channel: "email",
	channelAccount: { id: "mailbox-1", address: "support@example.com" },
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
		content: { type: "text/plain", value: "hello" },
		attachments: [],
		labels: [],
		sourceSendType: null,
		sentAt: "2026-08-03T03:20:00.000Z",
	},
	source: {
		system: "mail-service",
		topic: "UAT_RealTimeEmail",
		partition: 0,
		offset: 1,
		workerVersion: "test",
	},
};

describe("email mirror ingress", () => {
	it("requires a distinct constant-time service credential", () => {
		process.env.XIAOFEI_EMAIL_INGEST_API_KEY = "email-secret";
		expect(isValidEmailIngestAuthorization(undefined)).toBe(false);
		expect(isValidEmailIngestAuthorization("Bearer wrong")).toBe(false);
		expect(isValidEmailIngestAuthorization("Bearer email-secret")).toBe(true);
	});
	it("enforces schema and exact idempotency key", async () => {
		expect((await ingestEmailMessage({}, "x")).body).toEqual({ error: "invalid_request" });
		expect((await ingestEmailMessage(valid, "other")).body).toEqual({
			error: "idempotency_key_mismatch",
		});
	});
	it("returns durable accepted and duplicate locators without AI", async () => {
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
		expect((await ingestEmailMessage(valid, valid.eventId)).status).toBe(202);
		expect((await ingestEmailMessage(valid, valid.eventId)).status).toBe(200);
	});
});
