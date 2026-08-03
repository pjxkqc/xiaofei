import type { EmailMessageIngestV1 } from "@repo/xiaofei";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	const transaction = {
		xiaofeiInboundEvent: { findUnique: vi.fn(), create: vi.fn() },
		xiaofeiCustomer: { upsert: vi.fn() },
		xiaofeiConversation: { upsert: vi.fn(), updateMany: vi.fn() },
		xiaofeiConversationMessage: { create: vi.fn() },
		xiaofeiProcessingJob: { create: vi.fn() },
	};
	return {
		bindings: vi.fn(),
		transaction: vi.fn(async (callback) => callback(transaction)),
		...transaction,
	};
});

vi.mock("../client", () => ({
	db: { $transaction: mocks.transaction, xiaofeiChannelBinding: { findMany: mocks.bindings } },
}));

import {
	acceptMirroredEmailMessage,
	resolveActiveXiaofeiEmailChannelBinding,
	XiaofeiChannelBindingConflictError,
	XiaofeiChannelBindingDisabledError,
	XiaofeiChannelBindingNotFoundError,
} from "./xiaofei";

const email: EmailMessageIngestV1 = {
	schemaVersion: "email.message.v1" as const,
	eventId: "email:company-a:1",
	occurredAt: "2026-08-03T03:20:00.000Z",
	tenant: { companyId: "company-a" },
	channel: "email" as const,
	channelAccount: { id: "mailbox-a", address: "support@example.com" },
	conversation: { externalId: "email:company-a:conversation-a", loopdeskSessionId: null },
	message: {
		sourceMessageId: "email:message-a",
		providerMessageId: null,
		replyToSourceMessageId: null,
		direction: "inbound" as const,
		senderType: "customer" as const,
		from: { address: "customer@example.com", name: "Customer" },
		to: [{ address: "support@example.com", name: null }],
		subject: "Help",
		content: { type: "text/plain", value: "body" },
		attachments: null,
		sentAt: "2026-08-03T03:20:00.000Z",
		labels: null,
		sourceSendType: null,
	},
	source: { system: "mail-service", topic: "first", partition: 1, offset: 3, workerVersion: "one" },
};

describe("email mirror persistence", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.bindings.mockResolvedValue([
			{
				id: "binding-a",
				organizationId: "organization-a",
				workspaceId: "workspace-a",
				channelAccountId: "mailbox-a",
				address: "support@example.com",
				status: "active",
			},
		]);
		mocks.xiaofeiInboundEvent.findUnique.mockResolvedValue(null);
		mocks.xiaofeiCustomer.upsert.mockResolvedValue({ id: "customer-a", name: "Customer" });
		mocks.xiaofeiConversation.upsert.mockResolvedValue({ id: "conversation-a" });
		mocks.xiaofeiInboundEvent.create.mockResolvedValue({ id: "event-a" });
		mocks.xiaofeiConversationMessage.create.mockResolvedValue({ id: "message-a" });
		mocks.xiaofeiProcessingJob.create.mockResolvedValue({ id: "job-a" });
	});

	it("fails closed for missing, disabled, and split active bindings", async () => {
		mocks.bindings.mockResolvedValueOnce([]);
		await expect(
			resolveActiveXiaofeiEmailChannelBinding({
				companyId: "company-a",
				channelAccountId: "mailbox-a",
				address: "support@example.com",
			}),
		).rejects.toBeInstanceOf(XiaofeiChannelBindingNotFoundError);
		mocks.bindings.mockResolvedValueOnce([
			{
				id: "disabled",
				status: "disabled",
				channelAccountId: "mailbox-a",
				address: "support@example.com",
			},
		]);
		await expect(
			resolveActiveXiaofeiEmailChannelBinding({
				companyId: "company-a",
				channelAccountId: "mailbox-a",
				address: "support@example.com",
			}),
		).rejects.toBeInstanceOf(XiaofeiChannelBindingDisabledError);
		mocks.bindings.mockResolvedValueOnce([
			{ id: "id", status: "active", channelAccountId: "mailbox-a", address: "other@example.com" },
			{
				id: "address",
				status: "active",
				channelAccountId: "other",
				address: "support@example.com",
			},
		]);
		await expect(
			resolveActiveXiaofeiEmailChannelBinding({
				companyId: "company-a",
				channelAccountId: "mailbox-a",
				address: "support@example.com",
			}),
		).rejects.toBeInstanceOf(XiaofeiChannelBindingConflictError);
	});

	it("atomically records inbound customer email and one mirrored job", async () => {
		await expect(acceptMirroredEmailMessage(email)).resolves.toEqual({
			status: "accepted",
			conversationId: "conversation-a",
			messageId: "message-a",
			jobId: "job-a",
		});
		expect(mocks.xiaofeiInboundEvent.create).toHaveBeenCalledTimes(1);
		expect(mocks.xiaofeiConversationMessage.create).toHaveBeenCalledTimes(1);
		expect(mocks.xiaofeiProcessingJob.create).toHaveBeenCalledTimes(1);
	});

	it("does not create a job for outbound email and returns the durable duplicate locator", async () => {
		const outbound = {
			...email,
			message: {
				...email.message,
				direction: "outbound" as const,
				senderType: "loopdesk" as const,
			},
		};
		await acceptMirroredEmailMessage(outbound);
		expect(mocks.xiaofeiProcessingJob.create).not.toHaveBeenCalled();
		// The business hash is supplied by the implementation; source replay metadata is intentionally ignored.
		await acceptMirroredEmailMessage(email);
		const created = mocks.xiaofeiInboundEvent.create.mock.calls[1]?.[0]?.data.payloadHash;
		mocks.xiaofeiInboundEvent.findUnique.mockResolvedValueOnce({
			payloadHash: created,
			conversationMessage: {
				id: "message-old",
				conversationId: "conversation-old",
				processingJob: { id: "job-old" },
			},
		});
		await expect(
			acceptMirroredEmailMessage({
				...email,
				source: { ...email.source, topic: "replay", offset: 99, workerVersion: "two" },
			}),
		).resolves.toEqual({
			status: "duplicate",
			conversationId: "conversation-old",
			messageId: "message-old",
			jobId: "job-old",
		});
	});
});
