import {
	createConversationState,
	createDefaultWorkspaceSnapshot,
	type EmailMessageIngestV1,
} from "@repo/xiaofei";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	claim: vi.fn(),
	complete: vi.fn(),
	createDelivery: vi.fn(),
	fail: vi.fn(),
	getLatest: vi.fn(),
	getOrganizationConfig: vi.fn(),
	getDeliveryConfig: vi.fn(),
	getProcessingContext: vi.fn(),
	getDelivery: vi.fn(),
	listDeliveries: vi.fn(),
	recordAttempt: vi.fn(),
	retarget: vi.fn(),
	saveDeliveryConfig: vi.fn(),
	runTurn: vi.fn(),
	getWorkspace: vi.fn(),
	getOrganizationId: vi.fn(),
	requireAdmin: vi.fn(),
}));

vi.mock("@repo/database", () => ({
	claimXiaofeiOrganizationEmailProcessingJob: mocks.claim,
	completeXiaofeiEmailReplyProcessing: mocks.complete,
	createXiaofeiOutboundDelivery: mocks.createDelivery,
	failXiaofeiOrganizationEmailProcessingJob: mocks.fail,
	getLatestXiaofeiOrganizationEmailMirrorContext: mocks.getLatest,
	getXiaofeiOrganizationConfig: mocks.getOrganizationConfig,
	getXiaofeiOrganizationEmailDeliveryConfig: mocks.getDeliveryConfig,
	getXiaofeiOrganizationEmailProcessingContext: mocks.getProcessingContext,
	getXiaofeiOrganizationOutboundDelivery: mocks.getDelivery,
	listXiaofeiOrganizationOutboundDeliveries: mocks.listDeliveries,
	recordXiaofeiOutboundDeliveryAttempt: mocks.recordAttempt,
	retargetXiaofeiOrganizationOutboundDelivery: mocks.retarget,
	saveXiaofeiOrganizationEmailDeliveryConfig: mocks.saveDeliveryConfig,
}));
vi.mock("@repo/ai", () => ({ runXiaofeiTurn: mocks.runTurn }));
vi.mock("./service", () => ({
	createKnowledgeWorkspaceBinding: vi.fn((input) => ({
		tenantId: input.workspace.tenantKey,
		conversationId: input.conversationId,
		channelId: input.channelId,
		knowledgeWorkspaceId: input.snapshot.knowledgeWorkspaceId,
	})),
	getOrCreateXiaofeiWorkspace: mocks.getWorkspace,
	getXiaofeiOrganizationId: mocks.getOrganizationId,
	requireXiaofeiOrganizationAdmin: mocks.requireAdmin,
}));

import {
	listEmailOutboundDeliveries,
	processMirroredEmailJob,
	saveEmailDeliverySettings,
	sendEmailCallbackTest,
} from "./email-delivery";

const inbound: EmailMessageIngestV1 = {
	schemaVersion: "email.message.v1",
	eventId: "email:company-a:event-a",
	occurredAt: "2026-08-04T03:20:00.000Z",
	tenant: { companyId: "company-a" },
	channel: "email",
	channelAccount: { id: "mailbox-a", address: "support@example.com" },
	conversation: { externalId: "email:company-a:customer-a", loopdeskSessionId: null },
	message: {
		sourceMessageId: "email:message-a",
		providerMessageId: null,
		replyToSourceMessageId: null,
		direction: "inbound",
		senderType: "customer",
		from: { address: "customer@example.com", name: "Customer" },
		to: [{ address: "support@example.com", name: null }],
		subject: "Product question",
		content: { type: "text/plain", value: "Which model fits?" },
		attachments: [],
		sentAt: "2026-08-04T03:20:00.000Z",
		labels: [],
		sourceSendType: 10,
	},
	source: {
		system: "mail-service",
		topic: "UAT_RealTimeEmail",
		partition: 0,
		offset: 1,
		workerVersion: "test",
	},
};

const snapshot = createDefaultWorkspaceSnapshot("organization:organization-a");
const state = createConversationState({
	id: inbound.conversation.externalId,
	tenantId: "organization:organization-a",
	agentId: snapshot.agent.id,
	maxFollowUps: snapshot.agent.maxFollowUps,
});
const processingContext = {
	id: "job-a",
	status: "mirrored",
	inboundEvent: { payload: inbound },
	conversationMessage: { contentType: "text/plain", contentValue: "Which model fits?" },
	conversation: {
		id: "conversation-a",
		externalId: inbound.conversation.externalId,
		revision: 3,
		ownerType: state.ownerType,
		ownerEpoch: state.ownerEpoch,
		state,
		messages: [
			{
				id: `email-source:${inbound.message.sourceMessageId}`,
				role: "customer",
				authorName: "Customer",
				text: "Which model fits?",
				createdAt: inbound.occurredAt,
			},
		],
		traceEvents: [],
	},
};

describe("Email callback delivery", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getOrganizationId.mockResolvedValue("organization-a");
		mocks.getWorkspace.mockResolvedValue({
			workspace: { id: "workspace-a", tenantKey: "organization:organization-a" },
			snapshot,
		});
		mocks.getOrganizationConfig.mockResolvedValue({ xiaofeiEnabled: true });
		mocks.getDeliveryConfig.mockResolvedValue({ mode: "mock", callbackUrl: null });
		mocks.getProcessingContext.mockResolvedValue(processingContext);
		mocks.claim.mockResolvedValue(true);
		mocks.runTurn.mockResolvedValue({
			reply: "C-Air Mini fits the documented room range.",
			state,
			metadata: { traces: [] },
		});
		mocks.complete.mockImplementation(async (input) => ({
			...input.delivery,
			payload: input.delivery.payload,
			status: "pending",
		}));
		mocks.recordAttempt.mockImplementation(async (input) => ({ ...input }));
	});

	it("persists the guarded Xiaofei reply before the built-in mock accepts it", async () => {
		await expect(processMirroredEmailJob({} as never, "job-a")).resolves.toMatchObject({
			status: "processed",
			deliveryStatus: "delivered",
			conversationId: inbound.conversation.externalId,
		});
		expect(mocks.runTurn).toHaveBeenCalledTimes(1);
		expect(mocks.complete).toHaveBeenCalledWith(
			expect.objectContaining({
				jobId: "job-a",
				externalId: inbound.conversation.externalId,
				expectedRevision: 3,
				expectedOwnerType: "ai",
				expectedOwnerEpoch: 0,
				delivery: expect.objectContaining({
					destinationMode: "mock",
					payload: expect.objectContaining({
						schemaVersion: "xiaofei.email.delivery.v1",
						event: expect.objectContaining({ type: "message.reply.requested" }),
					}),
				}),
			}),
		);
		expect(mocks.recordAttempt).toHaveBeenCalledWith(
			expect.objectContaining({ status: "delivered", responseStatus: 200 }),
		);
	});

	it("does not claim a job while Xiaofei is disabled for the merchant", async () => {
		mocks.getOrganizationConfig.mockResolvedValueOnce({ xiaofeiEnabled: false });
		await expect(processMirroredEmailJob({} as never, "job-a")).rejects.toThrow("Enable Xiaofei");
		expect(mocks.claim).not.toHaveBeenCalled();
	});

	it("creates a durable status-event test against the latest Email conversation", async () => {
		mocks.getLatest.mockResolvedValue({
			payload: inbound,
			conversationMessage: { conversation: { id: "conversation-a" } },
		});
		mocks.createDelivery.mockImplementation(async (input) => ({
			...input,
			payload: input.payload,
			status: "pending",
		}));
		await expect(sendEmailCallbackTest({} as never)).resolves.toMatchObject({
			status: "delivered",
		});
		expect(mocks.createDelivery).toHaveBeenCalledWith(
			expect.objectContaining({
				eventType: "conversation.status.changed",
				payload: expect.objectContaining({
					event: expect.objectContaining({ status: "xiaofei_received" }),
				}),
			}),
		);
	});

	it("rejects a non-HTTPS Receiver and never persists it", async () => {
		await expect(
			saveEmailDeliverySettings({} as never, {
				mode: "webhook",
				callbackUrl: "http://127.0.0.1/receive",
			}),
		).rejects.toThrow("public HTTPS");
		expect(mocks.saveDeliveryConfig).not.toHaveBeenCalled();
	});

	it("shows only the Receiver host in the default Outbox list", async () => {
		mocks.listDeliveries.mockResolvedValue([
			{
				id: "delivery-a",
				destinationMode: "webhook",
				destinationUrl: "https://worker.example.com/replies",
			},
		]);
		await expect(listEmailOutboundDeliveries({} as never)).resolves.toEqual([
			expect.objectContaining({
				destination: "worker.example.com",
				destinationUrl: undefined,
			}),
		]);
	});
});
