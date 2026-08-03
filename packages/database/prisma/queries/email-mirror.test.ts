import { ConversationStateSchema, type EmailMessageIngestV1 } from "@repo/xiaofei";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	const transaction = {
		xiaofeiChannelBinding: { findMany: vi.fn() },
		xiaofeiInboundEvent: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
		xiaofeiCustomer: { upsert: vi.fn(), updateMany: vi.fn() },
		xiaofeiConversation: {
			upsert: vi.fn(),
			findUnique: vi.fn(),
			create: vi.fn(),
			updateMany: vi.fn(),
		},
		xiaofeiConversationMessage: { create: vi.fn() },
		xiaofeiProcessingJob: { create: vi.fn() },
	};
	const root = {
		xiaofeiWorkspace: { findUnique: vi.fn() },
		xiaofeiChannelBinding: {
			findMany: vi.fn(),
			findUnique: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
		},
		xiaofeiInboundEvent: {
			findMany: vi.fn(),
			findUnique: vi.fn(),
			update: vi.fn(),
		},
		xiaofeiConversationMessage: { findMany: vi.fn(), findUnique: vi.fn() },
		xiaofeiProcessingJob: { findMany: vi.fn(), findUnique: vi.fn() },
	};
	return {
		transaction: vi.fn(async (callback) => callback(transaction)),
		root,
		...transaction,
	};
});

vi.mock("../client", () => ({
	db: { $transaction: mocks.transaction, ...mocks.root },
}));

import {
	acceptMirroredEmailMessage,
	createXiaofeiOrganizationEmailChannelBinding,
	getXiaofeiOrganizationConversationMessage,
	getXiaofeiOrganizationInboundEvent,
	getXiaofeiOrganizationProcessingJob,
	listXiaofeiOrganizationConversationMessages,
	listXiaofeiOrganizationEmailChannelBindings,
	listXiaofeiOrganizationInboundEvents,
	listXiaofeiOrganizationProcessingJobs,
	resolveActiveXiaofeiEmailChannelBinding,
	updateXiaofeiOrganizationEmailChannelBinding,
	XiaofeiChannelBindingConflictError,
	XiaofeiChannelBindingDisabledError,
	XiaofeiChannelBindingNotFoundError,
	XiaofeiChannelBindingWorkspaceMismatchError,
	XiaofeiEmailMirrorConflictError,
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

const outboundEmail: EmailMessageIngestV1 = {
	...email,
	eventId: "email:company-a:outbound-1",
	message: {
		...email.message,
		sourceMessageId: "email:outbound-message-a",
		direction: "outbound",
		senderType: "loopdesk",
		from: { address: "support@example.com", name: "Support" },
		to: [{ address: "customer@example.com", name: "Customer" }],
	},
};

const activeBinding = {
	id: "binding-a",
	organizationId: "organization-a",
	workspaceId: "workspace-a",
	channelAccountId: "mailbox-a",
	address: "support@example.com",
	status: "active",
};

const p2002 = Object.assign(new Error("unique constraint"), { code: "P2002" });

describe("email mirror persistence", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.transaction.mockImplementation(async (callback) => callback(mocks));
		mocks.root.xiaofeiWorkspace.findUnique.mockResolvedValue({ id: "workspace-a" });
		mocks.root.xiaofeiChannelBinding.findMany.mockResolvedValue([activeBinding]);
		mocks.xiaofeiChannelBinding.findMany.mockResolvedValue([activeBinding]);
		mocks.xiaofeiInboundEvent.findUnique.mockResolvedValue(null);
		mocks.xiaofeiCustomer.upsert.mockResolvedValue({ id: "customer-a", name: "Customer" });
		mocks.xiaofeiConversation.findUnique.mockResolvedValue(null);
		mocks.xiaofeiConversation.create.mockResolvedValue({ id: "conversation-a" });
		mocks.xiaofeiInboundEvent.create.mockResolvedValue({ id: "event-a" });
		mocks.xiaofeiConversationMessage.create.mockResolvedValue({ id: "message-a" });
		mocks.xiaofeiProcessingJob.create.mockResolvedValue({ id: "job-a" });
		mocks.root.xiaofeiInboundEvent.findMany.mockResolvedValue([]);
		mocks.root.xiaofeiConversationMessage.findMany.mockResolvedValue([]);
		mocks.root.xiaofeiProcessingJob.findMany.mockResolvedValue([]);
	});

	it("fails closed for missing, disabled, and split active bindings", async () => {
		mocks.root.xiaofeiChannelBinding.findMany.mockResolvedValueOnce([]);
		await expect(
			resolveActiveXiaofeiEmailChannelBinding({
				companyId: "company-a",
				channelAccountId: "mailbox-a",
				address: "support@example.com",
			}),
		).rejects.toBeInstanceOf(XiaofeiChannelBindingNotFoundError);
		mocks.root.xiaofeiChannelBinding.findMany.mockResolvedValueOnce([
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
		mocks.root.xiaofeiChannelBinding.findMany.mockResolvedValueOnce([
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

	it("rejects a single identifier match instead of routing it to a workspace", async () => {
		mocks.root.xiaofeiChannelBinding.findMany.mockResolvedValueOnce([
			{
				id: "id-only",
				status: "active",
				channelAccountId: "mailbox-a",
				address: "other@example.com",
			},
		]);
		await expect(
			resolveActiveXiaofeiEmailChannelBinding({
				companyId: "company-a",
				channelAccountId: "mailbox-a",
				address: "support@example.com",
			}),
		).rejects.toBeInstanceOf(XiaofeiChannelBindingConflictError);
		mocks.root.xiaofeiChannelBinding.findMany.mockResolvedValueOnce([
			{
				id: "address-only",
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

	it("rejects an active-disabled identifier split", async () => {
		mocks.root.xiaofeiChannelBinding.findMany.mockResolvedValueOnce([
			{
				id: "active",
				status: "active",
				channelAccountId: "mailbox-a",
				address: "other@example.com",
			},
			{
				id: "disabled",
				status: "disabled",
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
		await acceptMirroredEmailMessage(outboundEmail);
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

	it("uses the outbound recipient as customer and never advances customer seen", async () => {
		await acceptMirroredEmailMessage(outboundEmail);
		expect(mocks.xiaofeiCustomer.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				create: expect.objectContaining({ externalCustomerId: "customer@example.com" }),
			}),
		);
		expect(mocks.xiaofeiCustomer.updateMany).not.toHaveBeenCalled();
	});

	it("stops before message and job if conversation ownership conflicts", async () => {
		mocks.xiaofeiConversation.findUnique.mockResolvedValueOnce({
			id: "conversation-a",
			customerId: "other-customer",
			channel: "email",
		});
		await expect(acceptMirroredEmailMessage(email)).rejects.toMatchObject({
			code: "EMAIL_CONVERSATION_CONFLICT",
		});
		expect(mocks.xiaofeiConversationMessage.create).not.toHaveBeenCalled();
		expect(mocks.xiaofeiProcessingJob.create).not.toHaveBeenCalled();
	});

	it("creates a parseable conversation state for a new mirrored conversation", async () => {
		await acceptMirroredEmailMessage(email);
		const state = mocks.xiaofeiConversation.create.mock.calls[0]?.[0]?.data.state;
		expect(ConversationStateSchema.parse(state)).toMatchObject({
			id: email.conversation.externalId,
			tenantId: "organization:organization-a",
			agentId: "email-mirror",
		});
	});

	it.each([
		{ customerId: "other-customer", channel: "email" },
		{ customerId: "customer-a", channel: "whatsapp" },
	])("rejects an existing conversation owned by another customer or channel", async (existing) => {
		mocks.xiaofeiConversation.findUnique.mockResolvedValueOnce({
			id: "conversation-a",
			...existing,
		});
		await expect(acceptMirroredEmailMessage(email)).rejects.toMatchObject({
			code: "EMAIL_CONVERSATION_CONFLICT",
		});
		expect(mocks.xiaofeiConversationMessage.create).not.toHaveBeenCalled();
		expect(mocks.xiaofeiProcessingJob.create).not.toHaveBeenCalled();
	});

	it("updates last-message and last-customer projections independently with monotonic guards", async () => {
		mocks.xiaofeiConversation.findUnique.mockResolvedValueOnce({
			id: "conversation-a",
			customerId: "customer-a",
			channel: "email",
		});
		await acceptMirroredEmailMessage(email);
		const occurredAt = new Date(email.occurredAt);
		expect(mocks.xiaofeiConversation.updateMany).toHaveBeenNthCalledWith(1, {
			where: {
				id: "conversation-a",
				OR: [{ lastMessageAt: null }, { lastMessageAt: { lte: occurredAt } }],
			},
			data: { lastMessageAt: occurredAt },
		});
		expect(mocks.xiaofeiConversation.updateMany).toHaveBeenNthCalledWith(2, {
			where: {
				id: "conversation-a",
				OR: [{ lastCustomerSeenAt: null }, { lastCustomerSeenAt: { lte: occurredAt } }],
			},
			data: { lastCustomerSeenAt: occurredAt },
		});
		expect(mocks.xiaofeiCustomer.updateMany).toHaveBeenCalledWith({
			where: {
				id: "customer-a",
				OR: [{ lastSeenAt: null }, { lastSeenAt: { lte: occurredAt } }],
			},
			data: { lastSeenAt: occurredAt },
		});
	});

	it("increments receipt metadata for an in-transaction duplicate without another message or job", async () => {
		await acceptMirroredEmailMessage(email);
		const payloadHash = mocks.xiaofeiInboundEvent.create.mock.calls[0]?.[0]?.data.payloadHash;
		vi.clearAllMocks();
		mocks.transaction.mockImplementation(async (callback) => callback(mocks));
		mocks.xiaofeiChannelBinding.findMany.mockResolvedValue([activeBinding]);
		mocks.xiaofeiInboundEvent.findUnique.mockResolvedValue({
			payloadHash,
			conversationMessage: {
				id: "message-a",
				conversationId: "conversation-a",
				processingJob: { id: "job-a" },
			},
		});
		await expect(acceptMirroredEmailMessage(email)).resolves.toMatchObject({
			status: "duplicate",
			messageId: "message-a",
			jobId: "job-a",
		});
		expect(mocks.xiaofeiInboundEvent.update).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ deliveryCount: { increment: 1 } }),
			}),
		);
		expect(mocks.xiaofeiConversationMessage.create).not.toHaveBeenCalled();
		expect(mocks.xiaofeiProcessingJob.create).not.toHaveBeenCalled();
	});

	it("maps a P2002 race with the same event and different payload to a typed conflict", async () => {
		mocks.transaction.mockRejectedValueOnce(p2002);
		mocks.root.xiaofeiInboundEvent.findUnique.mockResolvedValueOnce({
			payloadHash: "different-payload-hash",
			conversationMessage: {
				id: "message-a",
				conversationId: "conversation-a",
				processingJob: null,
			},
		});
		await expect(acceptMirroredEmailMessage(email)).rejects.toBeInstanceOf(
			XiaofeiEmailMirrorConflictError,
		);
		expect(mocks.transaction).toHaveBeenCalledTimes(1);
		expect(mocks.root.xiaofeiInboundEvent.update).not.toHaveBeenCalled();
	});

	it("resolves a P2002 race as duplicate only for the exact event, hash, and message locator", async () => {
		await acceptMirroredEmailMessage(email);
		const payloadHash = mocks.xiaofeiInboundEvent.create.mock.calls[0]?.[0]?.data.payloadHash;
		vi.clearAllMocks();
		mocks.transaction.mockRejectedValueOnce(p2002);
		mocks.root.xiaofeiChannelBinding.findMany.mockResolvedValue([activeBinding]);
		mocks.root.xiaofeiInboundEvent.findUnique.mockResolvedValueOnce({
			payloadHash,
			conversationMessage: {
				id: "message-a",
				conversationId: "conversation-a",
				processingJob: { id: "job-a" },
			},
		});
		await expect(acceptMirroredEmailMessage(email)).resolves.toEqual({
			status: "duplicate",
			conversationId: "conversation-a",
			messageId: "message-a",
			jobId: "job-a",
		});
		expect(mocks.root.xiaofeiInboundEvent.update).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					workspaceId_source_eventId: {
						workspaceId: "workspace-a",
						source: "email",
						eventId: email.eventId,
					},
				},
				data: expect.objectContaining({ deliveryCount: { increment: 1 } }),
			}),
		);
	});

	it("rethrows an unrelated P2002 without recursion when the exact event does not exist", async () => {
		mocks.transaction.mockRejectedValueOnce(p2002);
		mocks.root.xiaofeiInboundEvent.findUnique.mockResolvedValueOnce(null);
		await expect(acceptMirroredEmailMessage(email)).rejects.toBe(p2002);
		expect(mocks.transaction).toHaveBeenCalledTimes(1);
		expect(mocks.root.xiaofeiInboundEvent.update).not.toHaveBeenCalled();
	});

	it("stops before message and job when an earlier transactional write fails", async () => {
		const writeFailure = new Error("event write failed");
		mocks.xiaofeiInboundEvent.create.mockRejectedValueOnce(writeFailure);
		await expect(acceptMirroredEmailMessage(email)).rejects.toBe(writeFailure);
		expect(mocks.xiaofeiConversationMessage.create).not.toHaveBeenCalled();
		expect(mocks.xiaofeiProcessingJob.create).not.toHaveBeenCalled();
	});

	it("derives binding writes from the Organization workspace and rejects cross-tenant updates", async () => {
		mocks.root.xiaofeiChannelBinding.create.mockResolvedValueOnce({ id: "binding-a" });
		await createXiaofeiOrganizationEmailChannelBinding("organization-a", {
			companyId: "company-a",
			channelAccountId: "mailbox-a",
			address: " Support@Example.com ",
		});
		expect(mocks.root.xiaofeiChannelBinding.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				organizationId: "organization-a",
				workspaceId: "workspace-a",
				channel: "email",
				address: "support@example.com",
			}),
		});
		await listXiaofeiOrganizationEmailChannelBindings("organization-a");
		expect(mocks.root.xiaofeiChannelBinding.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					organizationId: "organization-a",
					workspaceId: "workspace-a",
					channel: "email",
				}),
			}),
		);
		mocks.root.xiaofeiChannelBinding.findUnique.mockResolvedValueOnce({
			id: "binding-other",
			organizationId: "organization-other",
			workspaceId: "workspace-other",
		});
		await expect(
			updateXiaofeiOrganizationEmailChannelBinding("organization-a", "binding-other", {
				status: "disabled",
			}),
		).rejects.toBeInstanceOf(XiaofeiChannelBindingWorkspaceMismatchError);
		expect(mocks.root.xiaofeiChannelBinding.update).not.toHaveBeenCalled();
	});

	it("keeps Organization metadata lists safe and detail reads workspace-scoped", async () => {
		await listXiaofeiOrganizationConversationMessages("organization-a", "conversation-a");
		await listXiaofeiOrganizationInboundEvents("organization-a");
		await listXiaofeiOrganizationProcessingJobs("organization-a");

		const messageListQuery = mocks.root.xiaofeiConversationMessage.findMany.mock.calls[0]?.[0];
		expect(messageListQuery.where).toEqual({
			workspaceId: "workspace-a",
			conversationId: "conversation-a",
		});
		expect(messageListQuery.select).not.toHaveProperty("contentValue");
		expect(messageListQuery.select).not.toHaveProperty("attachments");

		const eventListQuery = mocks.root.xiaofeiInboundEvent.findMany.mock.calls[0]?.[0];
		expect(eventListQuery.where).toMatchObject({ workspaceId: "workspace-a" });
		expect(eventListQuery.select).not.toHaveProperty("payload");
		expect(eventListQuery.select).not.toHaveProperty("safeHeaders");

		const jobListQuery = mocks.root.xiaofeiProcessingJob.findMany.mock.calls[0]?.[0];
		expect(jobListQuery.where).toEqual({ workspaceId: "workspace-a" });
		expect(jobListQuery.select).not.toHaveProperty("inboundEvent");
		expect(jobListQuery.select).not.toHaveProperty("conversationMessage");

		await getXiaofeiOrganizationConversationMessage("organization-a", "message-a");
		await getXiaofeiOrganizationInboundEvent("organization-a", "event-a");
		await getXiaofeiOrganizationProcessingJob("organization-a", "job-a");
		expect(mocks.root.xiaofeiConversationMessage.findUnique).toHaveBeenCalledWith({
			where: { workspaceId_id: { workspaceId: "workspace-a", id: "message-a" } },
		});
		expect(mocks.root.xiaofeiInboundEvent.findUnique).toHaveBeenCalledWith({
			where: { workspaceId_id: { workspaceId: "workspace-a", id: "event-a" } },
		});
		expect(mocks.root.xiaofeiProcessingJob.findUnique).toHaveBeenCalledWith({
			where: { workspaceId_id: { workspaceId: "workspace-a", id: "job-a" } },
		});
	});
});
